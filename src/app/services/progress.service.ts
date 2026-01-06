import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Progress {
  _id: string;
  studentId: number;
  term?: string;
  termYear?: number;
  gpa: number;
  creditsEarned: number;
  creditsAttempted: number;
  attendanceAbsences: number;
  gpaChange: number;
  trend: 'improving' | 'declining' | 'stable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  notes: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressHistoryResponse {
  success: boolean;
  student: {
    studentId: number;
    fullName: string;
    email: string;
    major: string;
  };
  progressHistory: Progress[];
  summary: {
    totalSnapshots: number;
    averageGPA: number;
    currentGPA: number;
    overallChange: number;
    trend: string;
    riskLevel: string;
  };
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

export interface DecliningStudentsResponse {
  success: boolean;
  count: number;
  students: Array<{
    student: {
      studentId: number;
      firstName: string;
      lastName: string;
      email: string;
      major: string;
    };
    currentGPA: number;
    previousGPA: number;
    gpaChange: number;
    trend: string;
    riskLevel: string;
    lastUpdated: string;
  }>;
}

export interface AdvisorProgressResponse {
  success: boolean;
  advisor: {
    advisorId: number;
    fullName: string;
  };
  statistics: {
    totalStudents: number;
    studentsWithProgress: number;
    averageGPA: number;
    atRiskCount: number;
    decliningCount: number;
  };
  students: Array<{
    studentId: number;
    currentGPA: number;
    trend: string;
    riskLevel: string;
    lastUpdated: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  private apiUrl = '/api/progress';

  constructor(private http: HttpClient) {}

  /**
   * Get progress history for a specific student
   */
  getStudentProgress(
    studentId: number,
    options?: {
      limit?: number;
      skip?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Observable<ProgressHistoryResponse> {
    let params = new HttpParams();
    if (options?.limit) params = params.set('limit', options.limit.toString());
    if (options?.skip) params = params.set('skip', options.skip.toString());
    if (options?.startDate) params = params.set('startDate', options.startDate);
    if (options?.endDate) params = params.set('endDate', options.endDate);

    return this.http.get<ProgressHistoryResponse>(`${this.apiUrl}/student/${studentId}`, { params });
  }

  /**
   * Create or update progress snapshot
   */
  createProgress(progressData: {
    studentId: number;
    term?: string;
    termYear?: number;
    gpa: number;
    creditsEarned?: number;
    creditsAttempted?: number;
    attendanceAbsences?: number;
    notes?: string;
  }): Observable<{ success: boolean; progress: Progress }> {
    return this.http.post<{ success: boolean; progress: Progress }>(this.apiUrl, progressData);
  }

  /**
   * Sync progress from CSV
   */
  syncProgress(studentId?: number): Observable<{ success: boolean; synced: number; errors?: any[] }> {
    const body = studentId ? { studentId } : {};
    return this.http.post<{ success: boolean; synced: number; errors?: any[] }>(`${this.apiUrl}/sync`, body);
  }

  /**
   * Get students with declining GPA
   */
  getDecliningStudents(threshold?: number, advisorId?: number): Observable<DecliningStudentsResponse> {
    let params = new HttpParams();
    if (threshold !== undefined) params = params.set('threshold', threshold.toString());
    if (advisorId) params = params.set('advisorId', advisorId.toString());

    return this.http.get<DecliningStudentsResponse>(`${this.apiUrl}/declining`, { params });
  }

  /**
   * Get progress statistics for advisor's students
   */
  getAdvisorProgress(advisorId: number): Observable<AdvisorProgressResponse> {
    return this.http.get<AdvisorProgressResponse>(`${this.apiUrl}/advisor/${advisorId}`);
  }

  /**
   * Get trend color
   */
  getTrendColor(trend: string): string {
    const colors: { [key: string]: string } = {
      'improving': '#10b981',
      'declining': '#ef4444',
      'stable': '#6b7280'
    };
    return colors[trend] || '#6b7280';
  }

  /**
   * Get risk level color
   */
  getRiskColor(riskLevel: string): string {
    const colors: { [key: string]: string } = {
      'low': '#10b981',
      'medium': '#f59e0b',
      'high': '#ef4444',
      'critical': '#dc2626'
    };
    return colors[riskLevel] || '#6b7280';
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
