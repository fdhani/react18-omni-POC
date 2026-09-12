import * as React from 'react';
import { withStyles } from '@material-ui/core/styles';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';

/**
 * A custom StepIcon component, matching the real app's dedicated
 * StepIcon.tsx module (its Stepper "set" of override modules) -- a step
 * indicator that swaps icon and color by step state (completed / active /
 * default), wired in via Step's `StepIconComponent` prop rather than a
 * theme-level class override. This exercises `withStyles` (the older
 * HOC-based styling API, used in exactly 2 files in the real app, versus
 * makeStyles's 1,701) on a component that also needs per-instance
 * variation (props-dependent styling), a different code path than a static
 * makeStyles hook.
 */

export const STEP_ICON_ACTIVE_COLOR = '#e91e63';
export const STEP_ICON_COMPLETED_COLOR = '#2e7d32';

const withStepIconStyles = withStyles({
  root: { display: 'flex', alignItems: 'center' },
  active: { color: STEP_ICON_ACTIVE_COLOR },
  completed: { color: STEP_ICON_COMPLETED_COLOR },
});

export interface CustomStepIconProps {
  active?: boolean;
  completed?: boolean;
  classes: { root: string; active: string; completed: string };
}

function CustomStepIconBase(props: CustomStepIconProps) {
  const { active, completed, classes } = props;
  const cls = `${classes.root} ${active ? classes.active : ''} ${completed ? classes.completed : ''}`.trim();
  if (completed) return <CheckCircleIcon className={cls} data-step-icon="completed" fontSize="small" />;
  if (active) return <FiberManualRecordIcon className={cls} data-step-icon="active" fontSize="small" />;
  return <RadioButtonUncheckedIcon className={cls} data-step-icon="default" fontSize="small" />;
}

export const StepIcon = withStepIconStyles(CustomStepIconBase);
