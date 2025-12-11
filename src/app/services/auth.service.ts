import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface LoginResponse {
  success: boolean;
  sessionToken?: string;
  user?: any;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api';
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const studentToken = localStorage.getItem('studentSessionToken');
    const advisorToken = localStorage.getItem('advisorSessionToken');
    
    if (studentToken) {
      const user = {
        studentId: localStorage.getItem('studentId'),
        fullName: localStorage.getItem('fullName'),
        email: localStorage.getItem('email'),
        major: localStorage.getItem('major'),
        year: localStorage.getItem('year'),
        role: 'student'
      };
      this.currentUserSubject.next(user);
    } else if (advisorToken) {
      const user = {
        advisorId: localStorage.getItem('advisorId'),
        fullName: localStorage.getItem('advisorFullName'),
        email: localStorage.getItem('advisorEmail'),
        department: localStorage.getItem('department'),
        role: 'advisor'
      };
      this.currentUserSubject.next(user);
    }
  }

  studentLogin(studentId: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/student/login`, {
      studentId,
      password
    }).pipe(
      tap(response => {
        if (response.success && response.sessionToken) {
          localStorage.setItem('studentSessionToken', response.sessionToken);
          localStorage.setItem('studentId', response.user.studentId);
          localStorage.setItem('fullName', response.user.fullName);
          localStorage.setItem('email', response.user.email);
          localStorage.setItem('major', response.user.major);
          localStorage.setItem('year', response.user.year);
          this.currentUserSubject.next({ ...response.user, role: 'student' });
        }
      })
    );
  }

  advisorLogin(email: string, password: string, department: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/advisor/login`, {
      email,
      password,
      department
    }).pipe(
      tap(response => {
        if (response.success && response.sessionToken) {
          localStorage.setItem('advisorSessionToken', response.sessionToken);
          localStorage.setItem('advisorFullName', response.user.fullName);
          localStorage.setItem('advisorEmail', response.user.email);
          localStorage.setItem('advisorId', response.user.advisorId);
          localStorage.setItem('department', response.user.department);
          this.currentUserSubject.next({ ...response.user, role: 'advisor' });
        }
      })
    );
  }

  studentRegister(data: any): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/student/register`, data);
  }

  advisorRegister(data: any): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/advisor/register`, data);
  }

  logout(): void {
    localStorage.clear();
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    return !!(localStorage.getItem('studentSessionToken') || localStorage.getItem('advisorSessionToken'));
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  getRole(): string | null {
    const user = this.getCurrentUser();
    return user ? user.role : null;
  }
}

