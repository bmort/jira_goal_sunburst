export class JiraError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "JiraError";
  }
}

export class TraversalLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraversalLimitError";
  }
}
