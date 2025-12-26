import { useCallback, useReducer } from 'react';

// Тип для определения переходов:
// { CurrentState: { Event: NextState } }
export type StateChart<S extends string, E extends string> = {
  [key in S]?: {
    [key in E]?: S;
  };
};

/**
 * Легковесный хук конечного автомата.
 * Гарантирует, что переходы возможны только по определенным правилам.
 */
export function useStateMachine<S extends string, E extends string>(
  initialState: S,
  chart: StateChart<S, E>
) {
  const [state, dispatch] = useReducer((currentState: S, event: E): S => {
    const transitions = chart[currentState];
    const nextState = transitions?.[event];

    // Если переход не определен, остаемся в текущем состоянии
    return nextState ?? currentState;
  }, initialState);

  const transition = useCallback((event: E) => {
    dispatch(event);
  }, []);

  /**
   * Проверка текущего состояния (Sugar helper).
   */
  const matches = useCallback((s: S) => state === s, [state]);

  return {
    state,
    transition,
    matches,
  };
}
