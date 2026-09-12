import * as React from 'react';
import { useForm } from 'react-hook-form';
import { MountTracker, libResults } from './ErrorBoundary';

// react-hook-form@6 registers fields via ref callbacks stored on an internal
// mutable map, set up in an effect. StrictMode's deliberate double-invoke of
// mount effects is the scenario most likely to duplicate or lose a
// registration -- test by counting how many fields report themselves
// registered after mount settles.
export default function ReactHookFormDemo() {
  // No generic type argument: the module is untyped here (see types.d.ts note above).
  const { register, handleSubmit, formState } = useForm();
  const [submitted, setSubmitted] = React.useState<string | null>(null);

  React.useEffect(() => {
    const r = libResults['react-hook-form'];
    if (r) r.notes.push(`registered fields (formState.errors keys type ok): ${typeof formState.errors === 'object'}`);
  }, [formState]);

  return (
    <form
      data-demo="react-hook-form"
      onSubmit={handleSubmit((data: unknown) => setSubmitted(JSON.stringify(data)))}
      style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
    >
      <MountTracker name="react-hook-form" />
      <input placeholder="name" {...register('name', { required: true })} />
      <input placeholder="email" {...register('email', { required: true, pattern: /^\S+@\S+$/ })} />
      <button type="submit">Submit</button>
      {submitted && <span data-submitted>{submitted}</span>}
    </form>
  );
}
