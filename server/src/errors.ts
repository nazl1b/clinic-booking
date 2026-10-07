// An error with an HTTP status whose message is safe to show to the user.
// Thrown from controllers and middleware; the error handler in app.ts turns it into
// { error: message } with this status. `cause` (e.g. the email service's error)
// is only logged, never sent.
export class HttpError extends Error {
  readonly status: number
  readonly expose = true

  constructor(status: number, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'HttpError'
    this.status = status
  }
}
