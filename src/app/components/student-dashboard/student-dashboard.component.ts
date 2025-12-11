import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-student-dashboard',
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.scss']
})
export class StudentDashboardComponent implements OnInit {
  currentUser: any;
  helpRequestForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router
  ) {
    this.helpRequestForm = this.fb.group({
      category: ['', Validators.required],
      subject: ['', Validators.required],
      details: ['', Validators.required],
      urgency: ['normal', Validators.required]
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser || this.currentUser.role !== 'student') {
      this.router.navigate(['/login']);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  submitHelpRequest(): void {
    if (this.helpRequestForm.valid) {
      const entry = {
        type: 'help-request',
        data: {
          studentId: this.currentUser.studentId,
          fullName: this.currentUser.fullName,
          email: this.currentUser.email,
          ...this.helpRequestForm.value
        }
      };

      this.apiService.createEntry(entry).subscribe({
        next: (response) => {
          alert('Help request submitted successfully!');
          this.helpRequestForm.reset({
            category: '',
            subject: '',
            details: '',
            urgency: 'normal'
          });
        },
        error: (error) => {
          console.error('Error submitting help request:', error);
          alert('Error submitting help request. Please try again.');
        }
      });
    }
  }
}

