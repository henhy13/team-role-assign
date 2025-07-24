declare module 'munkres-js' {
  /**
   * Solve the assignment problem using the Hungarian algorithm
   * @param costMatrix A 2D array representing the cost matrix
   * @returns Array of [row, column] pairs representing the optimal assignment
   */
  export function munkres(costMatrix: number[][]): [number, number][];
} 