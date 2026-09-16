export type Listener<T> = (payload: T) => void;
export type Unsubscribe = () => void;

/** `Events` maps an event name to its payload type; use `void` for payload-free events. */
export class Emitter<Events extends object> {
  // One cast, kept local: the map is heterogeneous by key, each Set is homogeneous.
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => {
      set.delete(listener as Listener<never>);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Copy first: a listener may unsubscribe itself while we iterate.
    for (const listener of [...set]) (listener as Listener<Events[K]>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
