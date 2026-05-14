let shuttingDown = false;

export function setShuttingDown() {
  shuttingDown = true;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}