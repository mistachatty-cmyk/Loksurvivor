/** A portable Studio project with every player-owned source needed to reopen it. */
import { strFromU8, strToU8, unzip, zip } from 'fflate';

import { hashBlob, isMediaAssetId } from '../localMediaStore';
import { loadStudioAudioAssets, referencedStudioAssetIds, saveStudioAudioFile } from './persistence';
import { parseProject, type StudioProject } from './project';

const FORMAT = 'survivor616-project';
const MAX_BUNDLE_BYTES = 512 * 1024 * 1024;
const MAX_ASSETS = 256;

interface BundleAsset {
  id: string;
  path: string;
  fileName: string;
  mimeType: string;
  createdAt: number;
}

interface BundleManifest {
  format: typeof FORMAT;
  version: 1;
  project: StudioProject;
  assets: BundleAsset[];
}

function zipAsync(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, { level: 0 }, (error, data) => (error ? reject(error) : resolve(data)));
  });
}

function unzipAsync(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    let count = 0;
    let expandedBytes = 0;
    unzip(bytes, {
      filter: (entry) => {
        count += 1;
        expandedBytes += entry.originalSize;
        if (count > MAX_ASSETS + 1 || expandedBytes > MAX_BUNDLE_BYTES + 8 * 1024 * 1024) {
          throw new Error('That project backup expands beyond the supported size.');
        }
        return entry.name === 'manifest.json' || /^assets\/[a-f0-9]{64}$/.test(entry.name);
      },
    }, (error, files) => (error ? reject(error) : resolve(files)));
  });
}

export async function createProjectBundle(project: StudioProject, sourceIds: Iterable<string>): Promise<Blob> {
  const ids = [...new Set(sourceIds)];
  const required = [
    ...project.tracks.flatMap((track) => track.clips.map((clip) => clip.bufferId)),
    ...project.kits.flatMap((kit) => kit.pads.flatMap((pad) => pad.sourceId ? [pad.sourceId] : [])),
  ];
  if (required.some((id) => !isMediaAssetId(id) || !ids.includes(id))) {
    throw new Error('This song uses a missing or session-only source. Re-import it before backing up.');
  }
  if (ids.some((id) => !isMediaAssetId(id))) {
    throw new Error('Some sounds are available only for this session. Free device storage and re-import them before backing up.');
  }
  if (ids.length > MAX_ASSETS) throw new Error('This project has too many sources for a portable backup.');
  const assets = await loadStudioAudioAssets(ids);
  if (assets.length !== ids.length) throw new Error('A source is missing from device storage. Restore it before exporting a project backup.');

  const files: Record<string, Uint8Array> = {};
  const manifest: BundleManifest = { format: FORMAT, version: 1, project: parseProject(project), assets: [] };
  let totalBytes = 0;
  for (const asset of assets) {
    totalBytes += asset.byteLength;
    if (totalBytes > MAX_BUNDLE_BYTES) throw new Error('This project is too large for a browser project backup.');
    const path = `assets/${asset.contentHash}`;
    files[path] = new Uint8Array(await asset.blob.arrayBuffer());
    manifest.assets.push({
      id: asset.id,
      path,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      createdAt: asset.createdAt,
    });
  }
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  const archive = await zipAsync(files);
  return new Blob([archive.slice().buffer], { type: 'application/zip' });
}

export async function readProjectBundle(file: File): Promise<{ project: StudioProject; assetIds: string[] }> {
  if (file.size > MAX_BUNDLE_BYTES + 8 * 1024 * 1024) throw new Error('That project backup is too large for this browser.');
  let files: Record<string, Uint8Array>;
  try {
    files = await unzipAsync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error('That file is not a readable .616project backup.');
  }
  const manifestBytes = files['manifest.json'];
  if (!manifestBytes) throw new Error('The project backup has no manifest.');
  let manifest: BundleManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as BundleManifest;
  } catch {
    throw new Error('The project backup manifest is damaged.');
  }
  if (manifest.format !== FORMAT || manifest.version !== 1 || !Array.isArray(manifest.assets)) {
    throw new Error('That project backup uses an unsupported format.');
  }
  if (manifest.assets.length > MAX_ASSETS) throw new Error('That project backup contains too many sources.');
  const project = parseProject(manifest.project);
  const sourceIds = new Set<string>();
  let totalBytes = 0;
  for (const asset of manifest.assets) {
    if (!isMediaAssetId(asset.id) || asset.path !== `assets/${asset.id.slice(7)}` || !files[asset.path]) {
      throw new Error('The project backup contains a missing or invalid source reference.');
    }
  }
  for (const asset of manifest.assets) {
    const hash = await hashBlob(new Blob([files[asset.path]!.slice().buffer]));
    if (`sha256:${hash}` !== asset.id) throw new Error(`The project backup contains altered audio: ${asset.fileName || 'source'}.`);
  }
  const requiredIds = new Set(referencedStudioAssetIds(project));
  for (const id of requiredIds) {
    if (!manifest.assets.some((asset) => asset.id === id)) {
      throw new Error('The project backup omits audio used by the song.');
    }
  }
  for (const asset of manifest.assets) {
    const bytes = files[asset.path];
    if (!bytes) throw new Error(`The project backup is missing ${asset.fileName || 'a source'}.`);
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_BUNDLE_BYTES) throw new Error('That project backup is too large for this browser.');
    const name = typeof asset.fileName === 'string' && asset.fileName ? asset.fileName : `${asset.id.slice(7)}.wav`;
    const restored = await saveStudioAudioFile(new File([bytes.slice().buffer], name, {
      type: typeof asset.mimeType === 'string' ? asset.mimeType : 'audio/wav',
      lastModified: Number.isFinite(asset.createdAt) ? asset.createdAt : Date.now(),
    }));
    if (restored.id !== asset.id) throw new Error(`The project backup contains altered audio: ${name}.`);
    sourceIds.add(asset.id);
  }
  return { project, assetIds: [...sourceIds] };
}
