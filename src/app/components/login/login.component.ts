import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  currentMode: 'login' | 'signup' = 'login';
  currentType: 'student' | 'advisor' = 'student';
  
  studentLoginForm: FormGroup;
  advisorLoginForm: FormGroup;
  studentSignupForm: FormGroup;
  advisorSignupForm: FormGroup;

  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.studentLoginForm = this.fb.group({
      studentId: ['', Validators.required],
      password: ['', Validators.required]
    });

    this.advisorLoginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      department: ['', Validators.required]
    });

    this.studentSignupForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      studentId: ['', Validators.required],
      major: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    this.advisorSignupForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      advisorId: ['', Validators.required],
      department: ['', Validators.required],
      specialization: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  switchMode(mode: 'login' | 'signup'): void {
    this.currentMode = mode;
    this.clearMessages();
  }

  switchType(type: 'student' | 'advisor'): void {
    this.currentType = type;
    this.clearMessages();
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  onStudentLogin(): void {
    if (this.studentLoginForm.valid) {
      const { studentId, password } = this.studentLoginForm.value;
      this.authService.studentLogin(studentId, password).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Login successful! Redirecting...';
            setTimeout(() => {
              this.router.navigate(['/student/dashboard']);
            }, 1000);
          } else {
            this.errorMessage = response.error || 'Login failed. Please check your credentials.';
          }
        },
        error: (error) => {
          console.error('Login error:', error);
          this.errorMessage = 'Network error. Please try again.';
        }
      });
    }
  }

  onAdvisorLogin(): void {
    if (this.advisorLoginForm.valid) {
      const { email, password, department } = this.advisorLoginForm.value;
      this.authService.advisorLogin(email, password, department).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Login successful! Redirecting...';
            setTimeout(() => {
              this.router.navigate(['/advisor/dashboard']);
            }, 1000);
          } else {
            this.errorMessage = response.error || 'Login failed. Please check your credentials.';
          }
        },
        error: (error) => {
          console.error('Login error:', error);
          this.errorMessage = 'Network error. Please try again.';
        }
      });
    }
  }

  onStudentSignup(): void {
    if (this.studentSignupForm.valid) {
      const formValue = this.studentSignupForm.value;
      const { confirmPassword, ...signupData } = formValue;
      
      this.authService.studentRegister(signupData).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = response.message || 'Registration successful! You can now log in.';
            this.studentSignupForm.reset();
            setTimeout(() => {
              this.switchMode('login');
              this.switchType('student');
            }, 2000);
          } else {
            this.errorMessage = response.error || 'Registration failed. Please try again.';
          }
        },
        error: (error) => {
          console.error('Signup error:', error);
          this.errorMessage = 'Network error. Please try again.';
        }
      });
    }
  }

  onAdvisorSignup(): void {
    if (this.advisorSignupForm.valid) {
      const formValue = this.advisorSignupForm.value;
      const { confirmPassword, ...signupData } = formValue;
      
      this.authService.advisorRegister(signupData).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = response.message || 'Registration successful! You can now log in.';
            this.advisorSignupForm.reset();
            setTimeout(() => {
              this.switchMode('login');
              this.switchType('advisor');
            }, 2000);
          } else {
            this.errorMessage = response.error || 'Registration failed. Please try again.';
          }
        },
        error: (error) => {
          console.error('Signup error:', error);
          this.errorMessage = 'Network error. Please try again.';
        }
      });
    }
  }
}

