// Errors a service throws for the UI to handle (see formAction in
// src/lib/form-state.ts).

// The acting User lacks the role for this.
export class NotAllowedError extends Error {}

// A rule about the input was broken; the message is shown to the User.
export class UserInputError extends Error {}
