export class InvalidTransition extends Error {
  constructor(from: string, event: string) {
    super(`Cannot apply "${event}" to a request that is "${from}"`);
    this.name = "InvalidTransition";
  }
}

export class RequestNotFound extends Error {
  constructor(id: string) {
    super(`No request with id "${id}"`);
    this.name = "RequestNotFound";
  }
}

export class InvalidRequestInput extends Error {
  constructor(details: string) {
    super(`Request input is not valid: ${details}`);
    this.name = "InvalidRequestInput";
  }
}
