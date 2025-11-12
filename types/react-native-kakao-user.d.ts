declare module "@react-native-kakao/user" {
  export interface OAuthToken {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
    refreshTokenExpiresIn?: number;
    scope?: string;
  }

  export interface LoginOptions {
    throughTalk?: boolean;
    prompts?: string[];
  }

  export function login(options?: LoginOptions): Promise<OAuthToken>;
  export function isKakaoTalkLoginAvailable(): Promise<boolean>;
}
