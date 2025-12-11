import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { StudentDashboardComponent } from './components/student-dashboard/student-dashboard.component';
import { AdvisorDashboardComponent } from './components/advisor-dashboard/advisor-dashboard.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    StudentDashboardComponent,
    AdvisorDashboardComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

