export interface StudentInput {
  secularName: string;
  christianName?: string;
  university?: string;
  department?: string;
}

export interface TokenResponse {
  displayName: string;
  invitationCode: string;
}
