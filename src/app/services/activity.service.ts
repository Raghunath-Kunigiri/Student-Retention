import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Activity {
  _id: string;
  studentId: number;
  type: string;
  title: string;
  description: string;
  performedBy: {
    type: string;
    advisorId?: string;
    advisorName?: string;
    studentId?: number;
    studentName?: string;
  };
  metadata: any;
  priority: string;
  status: string;
  activityDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityTimelineResponse {
  success: boolean;
  student?: {
    studentId: number;
    fullName: string;
    email: string;
  };
  advisor?: {
    advisorId: number;
    fullName: string;
  };
  activities: Activity[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

export interface ActivityStats {
  total: number;
  last30Days: number;
  byType: {
    [key: string]: {
      count: number;
      latest: string;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  private apiUrl = '/api/activities';

  constructor(private http: HttpClient) {}

  /**
   * Get activity timeline for a specific student
   */
  getStudentTimeline(
    studentId: number,
    options?: {
      limit?: number;
      skip?: number;
      type?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Observable<ActivityTimelineResponse> {
    let params = new HttpParams();
    if (options?.limit) params = params.set('limit', options.limit.toString());
    if (options?.skip) params = params.set('skip', options.skip.toString());
    if (options?.type) params = params.set('type', options.type);
    if (options?.startDate) params = params.set('startDate', options.startDate);
    if (options?.endDate) params = params.set('endDate', options.endDate);

    return this.http.get<ActivityTimelineResponse>(`${this.apiUrl}/student/${studentId}`, { params });
  }

  /**
   * Get all activities for advisor's students
   */
  getAdvisorActivities(
    advisorId: number,
    options?: {
      limit?: number;
      skip?: number;
      type?: string;
      startDate?: string;
      endDate?: string;
      studentId?: number;
    }
  ): Observable<ActivityTimelineResponse> {
    let params = new HttpParams();
    if (options?.limit) params = params.set('limit', options.limit.toString());
    if (options?.skip) params = params.set('skip', options.skip.toString());
    if (options?.type) params = params.set('type', options.type);
    if (options?.startDate) params = params.set('startDate', options.startDate);
    if (options?.endDate) params = params.set('endDate', options.endDate);
    if (options?.studentId) params = params.set('studentId', options.studentId.toString());

    return this.http.get<ActivityTimelineResponse>(`${this.apiUrl}/advisor/${advisorId}`, { params });
  }

  /**
   * Get activity statistics for a student
   */
  getStudentActivityStats(studentId: number): Observable<{ success: boolean; stats: ActivityStats }> {
    return this.http.get<{ success: boolean; stats: ActivityStats }>(`${this.apiUrl}/student/${studentId}/stats`);
  }

  /**
   * Create a new activity
   */
  createActivity(activityData: {
    studentId: number;
    type: string;
    title: string;
    description?: string;
    performedBy?: any;
    metadata?: any;
    priority?: string;
    activityDate?: string;
  }): Observable<{ success: boolean; activity: Activity }> {
    return this.http.post<{ success: boolean; activity: Activity }>(this.apiUrl, activityData);
  }

  /**
   * Get activity type label
   */
  getActivityTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'help_request': 'Help Request',
      'help_request_response': 'Help Request Response',
      'notification_sent': 'Notification Sent',
      'notification_read': 'Notification Read',
      'advisor_contact': 'Advisor Contact',
      'risk_score_change': 'Risk Score Change',
      'academic_update': 'Academic Update',
      'financial_update': 'Financial Update',
      'housing_update': 'Housing Update',
      'login': 'Login',
      'profile_update': 'Profile Update',
      'meeting_scheduled': 'Meeting Scheduled',
      'meeting_completed': 'Meeting Completed',
      'note_added': 'Note Added'
    };
    return labels[type] || type;
  }

  /**
   * Get priority color
   */
  getPriorityColor(priority: string): string {
    const colors: { [key: string]: string } = {
      'urgent': '#dc2626',
      'high': '#ea580c',
      'normal': '#2563eb',
      'low': '#6b7280'
    };
    return colors[priority] || '#6b7280';
  }

  /**
   * Format activity date
   */
  formatActivityDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

