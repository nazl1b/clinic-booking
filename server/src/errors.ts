// An error with an HTTP status whose message is safe to show to the user.
// Thrown from controllers and middleware; the error handler in app.ts turns it into
// { error: message } with this status.
export class HttpError extends Error {
  readonly status: number
  readonly expose = true

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}
