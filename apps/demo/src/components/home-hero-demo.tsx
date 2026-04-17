"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { SessionState, Step } from "opensphinx/schemas";

import { DemoFormClient } from "./demo-form-client";
import { StepInspector, type StepEvent } from "./step-inspector";

type HeroDemoContextValue = {
  readonly events: readonly StepEvent[];
  readonly pushEvent: (event: StepEvent) => void;
  readonly hasModelOnServer: boolean;
};

const HeroDemoContext = createContext<HeroDemoContextValue | null>(null);

function useHeroDemo() {
  const ctx = useContext(HeroDemoContext);
  if (!ctx) {
    throw new Error(
      "useHeroDemo must be used inside <HeroDemoProvider>"
    );
  }
  return ctx;
}

export function HeroDemoProvider({
  children,
  initialEvents,
  hasModelOnServer
}: {
  readonly children: ReactNode;
  readonly initialEvents: readonly StepEvent[];
  readonly hasModelOnServer: boolean;
}) {
  const [events, setEvents] = useState<StepEvent[]>(() => [...initialEvents]);
  const pushEvent = useCallback((event: StepEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  const value = useMemo<HeroDemoContextValue>(
    () => ({ events, pushEvent, hasModelOnServer }),
    [events, pushEvent, hasModelOnServer]
  );

  return (
    <HeroDemoContext.Provider value={value}>{children}</HeroDemoContext.Provider>
  );
}

export function HeroDemoInspector() {
  const { events, hasModelOnServer } = useHeroDemo();
  return <StepInspector events={events} hasModelOnServer={hasModelOnServer} />;
}

export function HeroDemoForm({
  previewSession,
  previewStep
}: {
  readonly previewSession: SessionState;
  readonly previewStep: Step;
}) {
  const { pushEvent, hasModelOnServer } = useHeroDemo();

  return (
    <DemoFormClient
      hasModelOnServer={hasModelOnServer}
      initialSession={previewSession}
      initialSteps={[previewStep]}
      mode="preview"
      onStepEvent={pushEvent}
      showInspector={false}
      showOpenAiKeyHint={false}
    />
  );
}
