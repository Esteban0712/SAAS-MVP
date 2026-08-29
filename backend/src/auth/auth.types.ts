export type JwtActorType = 'USER' | 'PLATFORM';

export interface AuthTokenPayload {
  sub: string;
  actorType: JwtActorType;
  businessId?: string;
}

export type AuthenticatedPrincipal =
  | {
      actorType: 'USER';
      userId: string;
      businessId: string;
      roleId: string;
      username: string;
      displayName: string | null;
      permissions: string[];
    }
  | {
      actorType: 'PLATFORM';
      platformUserId: string;
      username: string;
    };
