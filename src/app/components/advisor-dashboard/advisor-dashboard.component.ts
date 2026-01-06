import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { ActivityService, Activity } from '../../services/activity.service';
import { ProgressService, Progress, DecliningStudentsResponse, AdvisorProgressResponse } from '../../services/progress.service';
import { Chart, registerables } from 'chart.js';

@Component({
  selector: 'app-advisor-dashboard',
  templateUrl: './advisor-dashboard.component.html',
  styleUrls: ['./advisor-dashboard.component.scss']
})
export class AdvisorDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('gpaChart', { static: false }) gpaChartRef!: ElementRef;
  @ViewChild('trendChart', { static: false }) trendChartRef!: ElementRef;

  currentUser: any;
  activeTab: string = 'overview';
  activities: Activity[] = [];
  loadingActivities: boolean = false;
  selectedStudentId: number | null = null;
  activityFilter: string = 'all';
  activityStats: any = null;

  // Progress tracking
  progressData: AdvisorProgressResponse | null = null;
  decliningStudents: any[] = [];
  loadingProgress: boolean = false;
  selectedProgressStudentId: number | null = null;
  studentProgressHistory: Progress[] = [];
  loadingStudentProgress: boolean = false;
  gpaChart: Chart | null = null;
  trendChart: Chart | null = null;

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private activityService: ActivityService,
    private progressService: ProgressService,
    private router: Router
  ) {
    Chart.register(...registerables);
  }

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

  ngAfterViewInit(): void {
    // Charts will be initialized when progress tab is opened
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'timeline') {
      this.loadActivities();
    } else if (tab === 'progress') {
      this.loadProgressData();
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

  // Progress tracking methods
  loadProgressData(): void {
    if (!this.currentUser?.advisorId) return;

    this.loadingProgress = true;
    this.progressService.getAdvisorProgress(this.currentUser.advisorId).subscribe({
      next: (response) => {
        if (response.success) {
          this.progressData = response;
          this.loadDecliningStudents();
        }
        this.loadingProgress = false;
      },
      error: (error) => {
        console.error('Error loading progress data:', error);
        this.loadingProgress = false;
      }
    });
  }

  loadDecliningStudents(): void {
    if (!this.currentUser?.advisorId) return;

    this.progressService.getDecliningStudents(-0.2, this.currentUser.advisorId).subscribe({
      next: (response) => {
        if (response.success) {
          this.decliningStudents = response.students;
        }
      },
      error: (error) => {
        console.error('Error loading declining students:', error);
      }
    });
  }

  loadStudentProgress(studentId: number): void {
    this.selectedProgressStudentId = studentId;
    this.loadingStudentProgress = true;

    this.progressService.getStudentProgress(studentId, { limit: 20 }).subscribe({
      next: (response) => {
        if (response.success) {
          this.studentProgressHistory = response.progressHistory;
          this.renderCharts();
        }
        this.loadingStudentProgress = false;
      },
      error: (error) => {
        console.error('Error loading student progress:', error);
        this.loadingStudentProgress = false;
      }
    });
  }

  renderCharts(): void {
    if (!this.studentProgressHistory || this.studentProgressHistory.length === 0) return;

    // Sort by date (oldest first) for chart
    const sortedHistory = [...this.studentProgressHistory].reverse();
    const dates = sortedHistory.map(p => this.progressService.formatDate(p.recordedAt));
    const gpaValues = sortedHistory.map(p => p.gpa);

    // Destroy existing charts
    if (this.gpaChart) {
      this.gpaChart.destroy();
    }
    if (this.trendChart) {
      this.trendChart.destroy();
    }

    // Render GPA trend chart
    if (this.gpaChartRef?.nativeElement) {
      const ctx = this.gpaChartRef.nativeElement.getContext('2d');
      this.gpaChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label: 'GPA',
            data: gpaValues,
            borderColor: '#0d47a1',
            backgroundColor: 'rgba(13, 71, 161, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: false,
              min: 0,
              max: 4.0,
              ticks: {
                stepSize: 0.5
              }
            }
          },
          plugins: {
            legend: {
              display: true
            },
            tooltip: {
              callbacks: {
                label: (context) => `GPA: ${context.parsed.y.toFixed(2)}`
              }
            }
          }
        }
      });
    }

    // Render trend distribution chart
    if (this.trendChartRef?.nativeElement) {
      const trendCounts = {
        improving: sortedHistory.filter(p => p.trend === 'improving').length,
        declining: sortedHistory.filter(p => p.trend === 'declining').length,
        stable: sortedHistory.filter(p => p.trend === 'stable').length
      };

      const ctx = this.trendChartRef.nativeElement.getContext('2d');
      this.trendChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Improving', 'Declining', 'Stable'],
          datasets: [{
            data: [trendCounts.improving, trendCounts.declining, trendCounts.stable],
            backgroundColor: [
              '#10b981',
              '#ef4444',
              '#6b7280'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    }
  }

  syncProgress(): void {
    if (!this.currentUser?.advisorId) return;

    this.loadingProgress = true;
    this.progressService.syncProgress().subscribe({
      next: (response) => {
        if (response.success) {
          alert(`Synced ${response.synced} progress records`);
          this.loadProgressData();
        }
        this.loadingProgress = false;
      },
      error: (error) => {
        console.error('Error syncing progress:', error);
        alert('Error syncing progress data');
        this.loadingProgress = false;
      }
    });
  }

  getTrendColor(trend: string): string {
    return this.progressService.getTrendColor(trend);
  }

  getRiskColor(riskLevel: string): string {
    return this.progressService.getRiskColor(riskLevel);
  }

  formatDate(dateString: string): string {
    return this.progressService.formatDate(dateString);
  }
}

