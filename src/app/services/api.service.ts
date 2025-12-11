import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  // Student endpoints
  getStudentData(studentId?: number): Observable<any> {
    const params = studentId ? new HttpParams().set('studentId', studentId.toString()) : undefined;
    return this.http.get(`${this.apiUrl}/data/students`, { params });
  }

  getCsvStudents(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }
    return this.http.get(`${this.apiUrl}/data/csv-students`, { params: httpParams });
  }

  getCsvStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/data/csv-stats`);
  }

  // Entry/Help Request endpoints
  createEntry(entry: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/entries`, entry);
  }

  getEntries(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }
    return this.http.get(`${this.apiUrl}/entries`, { params: httpParams });
  }

  getEntry(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/entries/${id}`);
  }

  sendMessage(entryId: string, message: string, senderType: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/entries/${entryId}/messages`, {
      message,
      senderType
    });
  }

  // Notification endpoints
  getNotifications(advisorId?: string): Observable<any> {
    const params = advisorId ? new HttpParams().set('advisorId', advisorId) : undefined;
    return this.http.get(`${this.apiUrl}/notifications`, { params });
  }

  getStudentNotifications(studentId?: number): Observable<any> {
    const params = studentId ? new HttpParams().set('studentId', studentId.toString()) : undefined;
    return this.http.get(`${this.apiUrl}/student-notifications`, { params });
  }

  markNotificationRead(id: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/notifications/${id}/read`, {});
  }

  replyToNotification(id: string, reply: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/${id}/reply`, reply);
  }

  // Google Forms endpoints
  getGoogleFormResponses(advisorName?: string, advisorId?: string): Observable<any> {
    let params = new HttpParams();
    if (advisorName) params = params.set('advisorName', advisorName);
    if (advisorId) params = params.set('advisorId', advisorId);
    return this.http.get(`${this.apiUrl}/google-forms/responses`, { params });
  }

  // Help Request Response endpoints
  createHelpRequestResponse(response: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/help-request-responses`, response);
  }
}

