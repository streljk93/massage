export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string } | null) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            el: HTMLElement,
            config: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin" | "signup" | "continue";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              /** Button label language (BCP-47, e.g. en, ru, vi). */
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}
