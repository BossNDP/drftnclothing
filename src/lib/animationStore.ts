import { create } from 'zustand';

export interface FlyingItem {
  id: string;
  imageUrl: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface AnimationState {
  flyingItems: FlyingItem[];
  cartPulseActive: boolean;
  wishlistPulseActive: boolean;
  addFlyingItem: (item: Omit<FlyingItem, 'id'>) => void;
  removeFlyingItem: (id: string) => void;
  triggerCartPulse: () => void;
  triggerWishlistPulse: () => void;
}

export const useAnimationStore = create<AnimationState>((set) => ({
  flyingItems: [],
  cartPulseActive: false,
  wishlistPulseActive: false,
  addFlyingItem: (item) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      flyingItems: [...state.flyingItems, { ...item, id }],
    }));
  },
  removeFlyingItem: (id) =>
    set((state) => ({
      flyingItems: state.flyingItems.filter((item) => item.id !== id),
    })),
  triggerCartPulse: () => {
    set({ cartPulseActive: true });
    setTimeout(() => {
      set({ cartPulseActive: false });
    }, 400); // Pulse duration is 400ms
  },
  triggerWishlistPulse: () => {
    // Phone Haptic Vibration on mobile devices
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined' && window.navigator.vibrate) {
      try {
        window.navigator.vibrate([25, 40, 25]);
      } catch (e) {
        // Ignore vibration errors if unsupported
      }
    }
    set({ wishlistPulseActive: true });
    setTimeout(() => {
      set({ wishlistPulseActive: false });
    }, 450); // Heart pulse duration is 450ms
  },
}));
