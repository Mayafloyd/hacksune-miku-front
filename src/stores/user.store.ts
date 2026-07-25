import {
  createStore,
  type LightweightStore,
} from "./create-store";

export type UserSessionStatus =
  | "guest"
  | "authenticated"
  | "expired";

export interface UserProfile {
  readonly id: string;
  readonly displayName: string;
  readonly initials: string;
  readonly email?: string;
  readonly city?: string;
}

export interface UserState {
  readonly profile: UserProfile;
  readonly sessionStatus: UserSessionStatus;
  readonly sessionLabel: string;
  readonly isDemonstration: boolean;
}

export interface UserStoreActions {
  setProfile(profile: UserProfile): void;
  setSessionStatus(status: UserSessionStatus): void;
  reset(): void;
}

export type UserStore = LightweightStore<UserState> &
  UserStoreActions;

const INITIAL_USER_STATE: UserState = {
  profile: {
    id: "demo-guest",
    displayName: "Invitado",
    initials: "IN",
  },
  sessionStatus: "guest",
  sessionLabel: "Sesión de demostración",
  isDemonstration: true,
};

const sessionLabel: Record<UserSessionStatus, string> = {
  guest: "Sesión de demostración",
  authenticated: "Sesión activa",
  expired: "Sesión vencida",
};

const baseStore = createStore(INITIAL_USER_STATE);

export const userStore: UserStore = {
  ...baseStore,
  setProfile: (profile) => {
    baseStore.patch({ profile });
  },
  setSessionStatus: (sessionStatus) => {
    baseStore.patch({
      sessionStatus,
      sessionLabel: sessionLabel[sessionStatus],
    });
  },
  reset: () => baseStore.reset(),
};

