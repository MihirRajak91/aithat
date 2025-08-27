/**
 * Background task processing system
 * Handles async operations without blocking the UI
 */

import { ErrorFactory, ExtensionError } from './errorTypes';
import { errorHandler } from '../ui/errorHandler';

export interface Task<T = any> {
  id: string;
  name: string;
  operation: () => Promise<T>;
  priority: 'low' | 'medium' | 'high';
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
}

export interface TaskResult<T = any> {
  id: string;
  status: 'completed' | 'failed' | 'cancelled';
  result?: T;
  error?: ExtensionError;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskProgress {
  id: string;
  status: TaskStatus;
  progress?: number;
  message?: string;
}

/**
 * Background task queue with priority and concurrency control
 */
export class TaskQueue {
  private static instance: TaskQueue;
  private tasks = new Map<string, Task>();
  private results = new Map<string, TaskResult>();
  private runningTasks = new Map<string, Promise<any>>();
  private listeners = new Map<string, Array<(progress: TaskProgress) => void>>();
  
  private readonly maxConcurrentTasks: number;
  private readonly defaultTimeout: number;
  private readonly defaultMaxRetries: number;

  private constructor(options: {
    maxConcurrentTasks?: number;
    defaultTimeout?: number;
    defaultMaxRetries?: number;
  } = {}) {
    this.maxConcurrentTasks = options.maxConcurrentTasks || 3;
    this.defaultTimeout = options.defaultTimeout || 30000; // 30 seconds
    this.defaultMaxRetries = options.defaultMaxRetries || 2;
  }

  static getInstance(): TaskQueue {
    if (!TaskQueue.instance) {
      TaskQueue.instance = new TaskQueue();
    }
    return TaskQueue.instance;
  }

  /**
   * Add a task to the queue
   */
  enqueue<T>(task: Omit<Task<T>, 'retryCount'>): Promise<TaskResult<T>> {
    const fullTask: Task<T> = {
      ...task,
      retryCount: 0,
      maxRetries: task.maxRetries ?? this.defaultMaxRetries,
      timeout: task.timeout ?? this.defaultTimeout
    };

    this.tasks.set(task.id, fullTask);
    
    // Notify listeners
    this.notifyListeners(task.id, { 
      id: task.id, 
      status: 'pending', 
      message: `Task "${task.name}" queued` 
    });

    // Start processing if possible
    this.processQueue();

    // Return promise that resolves when task completes
    return new Promise((resolve) => {
      const checkResult = () => {
        const result = this.results.get(task.id);
        if (result) {
          resolve(result as TaskResult<T>);
        } else {
          setTimeout(checkResult, 100);
        }
      };
      checkResult();
    });
  }

  /**
   * Cancel a task
   */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    // Remove from queue if not running
    if (!this.runningTasks.has(taskId)) {
      this.tasks.delete(taskId);
      this.results.set(taskId, {
        id: taskId,
        status: 'cancelled',
        startTime: new Date()
      });
      
      this.notifyListeners(taskId, { 
        id: taskId, 
        status: 'cancelled', 
        message: 'Task cancelled' 
      });
      
      return true;
    }

    // Mark running task for cancellation
    // (The actual cancellation depends on the task implementation)
    this.notifyListeners(taskId, { 
      id: taskId, 
      status: 'cancelled', 
      message: 'Cancellation requested' 
    });

    return true;
  }

  /**
   * Get task status
   */
  getStatus(taskId: string): TaskProgress | null {
    const task = this.tasks.get(taskId);
    const result = this.results.get(taskId);
    
    if (result) {
      return {
        id: taskId,
        status: result.status,
        message: result.error ? result.error.message : 'Task completed'
      };
    }
    
    if (this.runningTasks.has(taskId)) {
      return {
        id: taskId,
        status: 'running',
        message: task ? `Running "${task.name}"` : 'Task running'
      };
    }
    
    if (task) {
      return {
        id: taskId,
        status: 'pending',
        message: `Waiting to run "${task.name}"`
      };
    }
    
    return null;
  }

  /**
   * Listen to task progress updates
   */
  onProgress(taskId: string, listener: (progress: TaskProgress) => void): () => void {
    if (!this.listeners.has(taskId)) {
      this.listeners.set(taskId, []);
    }
    
    this.listeners.get(taskId)!.push(listener);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(taskId);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get all task results
   */
  getAllResults(): TaskResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Clear completed tasks
   */
  clearCompleted(): void {
    for (const [id, result] of this.results.entries()) {
      if (result.status === 'completed' || result.status === 'failed') {
        this.results.delete(id);
        this.listeners.delete(id);
      }
    }
  }

  /**
   * Get queue statistics
   */
    getStats(): {
        pending: number;
        running: number;
        completed: number;
        failed: number;
        cancelled: number;
    } {
    const stats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    // Count pending tasks
    stats.pending = this.tasks.size - this.runningTasks.size;
    stats.running = this.runningTasks.size;

    // Count completed tasks
    for (const result of this.results.values()) {
      stats[result.status]++;
    }

    return stats;
  }

  // Private methods

  private async processQueue(): Promise<void> {
    if (this.runningTasks.size >= this.maxConcurrentTasks) {
      return; // Max concurrency reached
    }

    // Get next highest priority task
    const nextTask = this.getNextTask();
    if (!nextTask) {
      return; // No tasks to process
    }

    // Start the task
    await this.executeTask(nextTask);
    
    // Process next task
    setTimeout(() => this.processQueue(), 0);
  }

  private getNextTask(): Task | null {
    const pendingTasks = Array.from(this.tasks.values())
      .filter(task => !this.runningTasks.has(task.id));
    
    if (pendingTasks.length === 0) {
      return null;
    }

    // Sort by priority (high > medium > low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    pendingTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    return pendingTasks[0];
  }

  private async executeTask<T>(task: Task<T>): Promise<void> {
    const startTime = new Date();
    
    this.notifyListeners(task.id, {
      id: task.id,
      status: 'running',
      message: `Starting "${task.name}"`
    });

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(ErrorFactory.rateLimited('TaskQueue', 'task', task.timeout));
      }, task.timeout);
    });

    // Execute the task with timeout
    const taskPromise = task.operation();
    this.runningTasks.set(task.id, taskPromise);

    try {
      const result = await Promise.race([taskPromise, timeoutPromise]);
      
      // Task completed successfully
      const endTime = new Date();
      const taskResult: TaskResult<T> = {
        id: task.id,
        status: 'completed',
        result,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime()
      };

      this.results.set(task.id, taskResult);
      this.tasks.delete(task.id);
      
      this.notifyListeners(task.id, {
        id: task.id,
        status: 'completed',
        message: `"${task.name}" completed successfully`
      });

    } catch (error) {
      // Task failed
      const extensionError = error instanceof ExtensionError 
        ? error 
        : ErrorFactory.workspaceError('TaskQueue', 'task_execution', error.message);

      // Check if we should retry
      if (task.retryCount! < task.maxRetries! && extensionError.isRetryable) {
        task.retryCount!++;
        this.notifyListeners(task.id, {
          id: task.id,
          status: 'pending',
          message: `Retrying "${task.name}" (attempt ${task.retryCount! + 1}/${task.maxRetries! + 1})`
        });
        
        // Re-queue for retry
        setTimeout(() => this.processQueue(), 1000 * task.retryCount!); // Exponential backoff
      } else {
        // Max retries reached or non-retryable error
        const endTime = new Date();
        const taskResult: TaskResult<T> = {
          id: task.id,
          status: 'failed',
          error: extensionError,
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime()
        };

        this.results.set(task.id, taskResult);
        this.tasks.delete(task.id);

        this.notifyListeners(task.id, {
          id: task.id,
          status: 'failed',
          message: `"${task.name}" failed: ${extensionError.message}`
        });

        // Handle error through error handler
        await errorHandler.handleExtensionError(extensionError);
      }
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  private notifyListeners(taskId: string, progress: TaskProgress): void {
    const listeners = this.listeners.get(taskId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(progress);
        } catch (error) {
          console.error('Error in task progress listener:', error);
        }
      });
    }
  }
}

// Global task queue instance
export const taskQueue = TaskQueue.getInstance();