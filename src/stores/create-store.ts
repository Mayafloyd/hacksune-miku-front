export type StoreListener = () => void;
export type StoreUpdater<State> =
  | State
  | ((currentState: State) => State);
export type StorePatch<State> =
  | Partial<State>
  | ((currentState: State) => Partial<State>);

export interface LightweightStore<State> {
  getState(): State;
  getSnapshot(): State;
  subscribe(listener: StoreListener): () => void;
  setState(updater: StoreUpdater<State>): void;
  patch(patch: StorePatch<State>): void;
  reset(): void;
}

/**
 * Store observable mínimo, compatible con `useSyncExternalStore`, sin agregar
 * una dependencia global de estado.
 */
export const createStore = <State>(
  initialState: State,
): LightweightStore<State> => {
  let state = initialState;
  const listeners = new Set<StoreListener>();

  const notify = (): void => {
    listeners.forEach((listener) => listener());
  };

  const setState = (updater: StoreUpdater<State>): void => {
    const nextState =
      typeof updater === "function"
        ? (updater as (currentState: State) => State)(state)
        : updater;
    if (Object.is(nextState, state)) return;
    state = nextState;
    notify();
  };

  return {
    getState: () => state,
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setState,
    patch: (patch) => {
      const partialState =
        typeof patch === "function" ? patch(state) : patch;
      setState({ ...state, ...partialState });
    },
    reset: () => setState(initialState),
  };
};

