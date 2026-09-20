import { IntroPhysicsBody } from '@/ui/introPhysics';

export interface IntroTitleProps {
  /** Optional alternate lockup. The reference stack remains the default. */
  oneLine: boolean;
}

export function IntroTitle({ oneLine }: IntroTitleProps) {
  return (
    <div className={`intro-title ${oneLine ? 'intro-title--one-line' : ''}`} data-testid="intro-title-stage">
      <h1 className="sr-only">Survivor616</h1>
      <IntroPhysicsBody id="title-616" order={1} className="intro-title__number" testId="intro-title-616">
        616
      </IntroPhysicsBody>
      <IntroPhysicsBody id="title-survivor" order={2} className="intro-title__word" testId="intro-title-survivor">
        Survivor
      </IntroPhysicsBody>
    </div>
  );
}

export default IntroTitle;
