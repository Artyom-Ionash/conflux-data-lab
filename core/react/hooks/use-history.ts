import { useCallback, useReducer } from 'react';

// --- 1. Типы и Утилиты ---

/**
 * Тип для функционального обновления, как в React.useState.
 * S — тип состояния.
 */
type StateUpdater<S> = S | ((prevState: S) => S);

/**
 * Type Guard для различения функционального обновления.
 *
 * NOTE: Здесь скрыто неизбежное архитектурное допущение React:
 * Если S является функцией, React не может отличить S от (S => S).
 * Конвенция: любая функция считается Updater-ом.
 */
function isUpdater<S>(value: StateUpdater<S>): value is (prevState: S) => S {
  return typeof value === 'function';
}

/**
 * Утилита для разрешения функционального обновления.
 * Проверяет, является ли значение функцией, и если да — вызывает её.
 */
function resolveValue<S>(val: StateUpdater<S>, current: S): S {
  if (isUpdater(val)) {
    return val(current);
  }
  return val;
}

interface HistoryState<T> {
  readonly past: T[];
  readonly present: T;
  readonly future: T[];
}

type HistoryAction<T> =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET'; newPresent: T; historySetting: 'push' | 'replace' }
  | { type: 'RESET'; initialPresent: T };

// --- 2. Reducer (Чистая логика) ---

function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> {
  const { past, present, future } = state;

  switch (action.type) {
    case 'UNDO': {
      const previous = past.at(-1);

      // Если previous undefined, значит история пуста (или в ней лежит undefined, что редкость, но обрабатывается)
      // Эта проверка делает 'previous' типом T (без undefined) в коде ниже.
      if (previous === undefined) return state;

      const newPast = past.slice(0, -1);

      return {
        past: newPast,
        present: previous,
        future: [present, ...future],
      };
    }

    case 'REDO': {
      const next = future.at(0);
      if (next === undefined) return state;

      const newFuture = future.slice(1);

      return {
        past: [...past, present],
        present: next,
        future: newFuture,
      };
    }

    case 'SET': {
      if (action.newPresent === present) return state;

      if (action.historySetting === 'replace') {
        return {
          past,
          present: action.newPresent,
          future,
        };
      }

      return {
        past: [...past, present],
        present: action.newPresent,
        future: [],
      };
    }

    case 'RESET': {
      return {
        past: [],
        present: action.initialPresent,
        future: [],
      };
    }

    default:
      return state;
  }
}

// --- 3. Hook ---

export function useHistory<T>(initialPresent: T) {
  const [state, dispatch] = useReducer(historyReducer<T>, {
    past: [],
    present: initialPresent,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  /**
   * Функция set теперь строго типизирована через StateUpdater<T>.
   */
  const set = useCallback(
    (update: StateUpdater<T>, historySetting: 'push' | 'replace' = 'push') => {
      // Резолвим значение "на месте", используя текущий present из замыкания reducer-а не получится,
      // так как dispatch асинхронен, но нам нужно передать payload прямо сейчас.
      // Поэтому мы используем функциональное обновление самого set,
      // но так как dispatch принимает Action, а не State, нам нужно вычислить значение ДО dispatch.
      // В React useReducer это делается иначе, здесь мы полагаемся на то, что
      // передаем в dispatch уже готовое значение T.

      // ВАЖНО: Так как мы внутри useCallback, 'state.present' может быть устаревшим,
      // если мы не добавим его в зависимости.
      // Добавляем state.present в deps.

      const newPresent = resolveValue(update, state.present);

      dispatch({
        type: 'SET',
        newPresent,
        historySetting,
      });
    },
    [state.present]
  );

  const reset = useCallback(
    (initial: T) => dispatch({ type: 'RESET', initialPresent: initial }),
    []
  );

  return {
    state: state.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    history: state,
  };
}
