export class ConfirmationResponseDto {
  success: boolean;
  message: string;
  data: any;
  requiresConfirmation?: boolean;
}
