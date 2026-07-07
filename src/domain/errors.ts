export class AppealToolError extends Error {}

export class UserInputError extends AppealToolError {}

export enum DataErrorKind {
  UnknownDataset = "unknown_dataset",
  TransientHttp = "transient_http",
  HttpError = "http_error",
  InvalidJson = "invalid_json",
  InvalidCache = "invalid_cache",
  Network = "network",
}

export class DataAccessError extends AppealToolError {
  constructor(
    message: string,
    readonly kind: DataErrorKind = DataErrorKind.Network,
  ) {
    super(message);
    this.name = "DataAccessError";
  }
}

export class NotFoundError extends AppealToolError {}
