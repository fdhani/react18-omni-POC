import * as React from 'react';
import Slider from 'react-slick';
import { makeStyles } from '@material-ui/core/styles';
// Import order matters: slick's own plain CSS first, then the custom
// override file, matching the real app's layering (and the actual
// CSS-injection-order risk named in the dependency-upgrade investigation).
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import './ReactSlickStylesDemo.css';
import { MountTracker, libResults } from './ErrorBoundary';

// A JSS class targeting content *inside* the slider, to check that MUI's
// JSS output and the two layers of plain CSS above don't fight each other
// under React 18 (e.g. JSS injecting after slick's CSS and accidentally
// winning specificity it shouldn't, or vice versa).
const useSlideStyles = makeStyles(() => ({
  slide: { height: 80, display: 'flex !important', alignItems: 'center', justifyContent: 'center', background: '#eef' },
}));

export default function ReactSlickDemo() {
  const classes = useSlideStyles();

  React.useEffect(() => {
    const id = requestAnimationFrame(() => {
      const r = libResults['react-slick'];
      if (!r) return;
      // First <li> is the active dot by default (slide 0 selected), so it
      // should show the custom CSS's *active*-dot color (#00aaff); any other
      // dot should show the custom base color (#ff00aa). Checking both,
      // rather than one hard-coded expectation, so a query that happens to
      // land on the active dot doesn't read as a false failure.
      const dots = Array.from(document.querySelectorAll('[data-slick-demo] .slick-dots li'));
      const activeDot = dots.find((d) => d.className.includes('slick-active'))?.querySelector('button');
      const otherDot = dots.find((d) => !d.className.includes('slick-active'))?.querySelector('button');
      const activeColor = activeDot ? getComputedStyle(activeDot, ':before').color : null;
      const otherColor = otherDot ? getComputedStyle(otherDot, ':before').color : null;
      const expectActive = 'rgb(0, 170, 255)'; // #00aaff, from ReactSlickStylesDemo.css .slick-active override
      const expectOther = 'rgb(255, 0, 170)'; // #ff00aa, from ReactSlickStylesDemo.css base override
      r.notes.push(
        activeColor === expectActive
          ? 'ok active slick dot ::before color (custom CSS beating slick-theme.css default)'
          : `FAIL active slick dot ::before color: expected ${expectActive} got ${activeColor}`,
      );
      r.notes.push(
        otherColor === expectOther
          ? 'ok inactive slick dot ::before color (custom CSS beating slick-theme.css default)'
          : `FAIL inactive slick dot ::before color: expected ${expectOther} got ${otherColor}`,
      );
      const slide = document.querySelector(`.${classes.slide.split(' ')[0]}`) as HTMLElement | null;
      r.notes.push(
        slide
          ? `JSS-styled slide background (expect rgb(238, 238, 255)): ${getComputedStyle(slide).backgroundColor}`
          : 'FAIL: JSS-styled slide element not found',
      );
    });
    return () => cancelAnimationFrame(id);
  }, [classes]);

  return (
    <div data-slick-demo data-demo="react-slick">
      <MountTracker name="react-slick" />
      <Slider dots infinite={false} speed={300} slidesToShow={1} slidesToScroll={1}>
        {[1, 2, 3].map((n) => (
          <div key={n}>
            <div className={classes.slide}>Slide {n}</div>
          </div>
        ))}
      </Slider>
    </div>
  );
}
