import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-advisor-dashboard',
  templateUrl: './advisor-dashboard.component.html',
  styleUrls: ['./advisor-dashboard.component.scss']
})
export class AdvisorDashboardComponent implements OnInit {
  currentUser: any;
  activeTab: string = 'overview';

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser || this.currentUser.role !== 'advisor') {
      this.router.navigate(['/login']);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
  }
}

