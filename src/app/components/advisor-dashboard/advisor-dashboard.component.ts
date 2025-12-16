import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { ActivityService, Activity } from '../../services/activity.service';

@Component({
  selector: 'app-advisor-dashboard',
  templateUrl: './advisor-dashboard.component.html',
  styleUrls: ['./advisor-dashboard.component.scss']
})
export class AdvisorDashboardComponent implements OnInit {
  currentUser: any;
  activeTab: string = 'overview';
  activities: Activity[] = [];
  loadingActivities: boolean = false;
  selectedStudentId: number | null = null;
  activityFilter: string = 'all';
  activityStats: any = null;

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private activityService: ActivityService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser || this.currentUser.role !== 'advisor') {
      this.router.navigate(['/login']);
      return;
    }
    
    // Load activities when timeline tab is active
    if (this.activeTab === 'timeline') {
      this.loadActivities();
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'timeline') {
      this.loadActivities();
    }
  }

  loadActivities(): void {
    if (!this.currentUser?.advisorId) return;

    this.loadingActivities = true;
    const options: any = {
      limit: 50,
      skip: 0
    };

    if (this.selectedStudentId) {
      options.studentId = this.selectedStudentId;
    }

    if (this.activityFilter !== 'all') {
      options.type = this.activityFilter;
    }

    this.activityService.getAdvisorActivities(this.currentUser.advisorId, options).subscribe({
      next: (response) => {
        if (response.success) {
          this.activities = response.activities;
        }
        this.loadingActivities = false;
      },
      error: (error) => {
        console.error('Error loading activities:', error);
        this.loadingActivities = false;
      }
    });
  }

  onStudentSelected(studentId: number | null): void {
    this.selectedStudentId = studentId;
    this.loadActivities();
  }

  onFilterChange(filter: string): void {
    this.activityFilter = filter;
    this.loadActivities();
  }

  getActivityTypeLabel(type: string): string {
    return this.activityService.getActivityTypeLabel(type);
  }

  getPriorityColor(priority: string): string {
    return this.activityService.getPriorityColor(priority);
  }

  formatActivityDate(dateString: string): string {
    return this.activityService.formatActivityDate(dateString);
  }
}

