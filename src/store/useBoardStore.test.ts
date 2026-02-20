import { expect, test, describe, beforeEach, mock } from "bun:test";

// Mock zustand before importing the store
mock.module("zustand", () => {
  return {
    create: (config) => {
      const createStore = (cfg) => {
        let state;
        const set = (partial, replace) => {
          const nextState = typeof partial === "function" ? partial(state) : partial;
          if (nextState !== state) {
            state = replace ? nextState : Object.assign({}, state, nextState);
          }
        };
        const get = () => state;
        const api = { getState: get, setState: set, subscribe: () => () => {} };
        state = cfg(set, get, api);
        return api;
      };

      if (config) {
        return createStore(config);
      }
      return createStore;
    },
  };
});

mock.module("zustand/middleware", () => {
  return {
    persist: (config) => (set, get, api) => config(set, get, api),
    createJSONStorage: () => ({}),
  };
});

// Use dynamic import to avoid hoisting
const { useBoardStore } = await import("./useBoardStore");

describe("useBoardStore - addItem", () => {
    beforeEach(() => {
        useBoardStore.getState().clearItems();
    });

    test("should add a new item", () => {
        const item = {
            id: '1',
            type: 'text' as const,
            content: 'test content',
            senderId: 'user1',
            timestamp: 1000,
            expiresAt: 5000
        };

        useBoardStore.getState().addItem(item);

        const state = useBoardStore.getState();
        expect(state.items).toHaveLength(1);
        expect(state.items[0]).toEqual(item);
    });

    test("should add expiresAt if missing", () => {
        const timestamp = 1000;
        const item = {
            id: '1',
            type: 'text' as const,
            content: 'test content',
            senderId: 'user1',
            timestamp: timestamp,
        } as any;

        useBoardStore.getState().addItem(item);

        const state = useBoardStore.getState();
        expect(state.items[0].expiresAt).toBe(timestamp + 60 * 60 * 1000);
    });

    test("should not add duplicate items by ID", () => {
        const item = {
            id: '1',
            type: 'text' as const,
            content: 'test content',
            senderId: 'user1',
            timestamp: 1000,
            expiresAt: 5000
        };

        useBoardStore.getState().addItem(item);
        useBoardStore.getState().addItem(item);

        const state = useBoardStore.getState();
        expect(state.items).toHaveLength(1);
    });

    test("should sort items by timestamp descending", () => {
        const item1 = {
            id: '1',
            type: 'text' as const,
            content: 'item 1',
            senderId: 'user1',
            timestamp: 1000,
            expiresAt: 5000
        };
        const item2 = {
            id: '2',
            type: 'text' as const,
            content: 'item 2',
            senderId: 'user1',
            timestamp: 2000,
            expiresAt: 6000
        };
        const item3 = {
            id: '3',
            type: 'text' as const,
            content: 'item 3',
            senderId: 'user1',
            timestamp: 1500,
            expiresAt: 5500
        };

        useBoardStore.getState().addItem(item1);
        useBoardStore.getState().addItem(item2);
        useBoardStore.getState().addItem(item3);

        const state = useBoardStore.getState();
        expect(state.items).toHaveLength(3);
        expect(state.items[0].id).toBe('2'); // latest
        expect(state.items[1].id).toBe('3'); // middle
        expect(state.items[2].id).toBe('1'); // oldest
    });
});
