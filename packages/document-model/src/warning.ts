/**
 * Warning system for collecting parse-time issues without failing.
 */

export type WarningSeverity = 'info' | 'warn' | 'error';

export interface ParseWarning {
  code: string;
  message: string;
  path?: string;
  severity: WarningSeverity;
}

export class WarningCollector {
  warnings: ParseWarning[] = [];

  add(code: string, message: string, path?: string, severity: WarningSeverity = 'warn'): void {
    this.warnings.push({ code, message, path, severity });
  }

  get count(): number {
    return this.warnings.length;
  }

  toJSON(): ParseWarning[] {
    return [...this.warnings];
  }
}
