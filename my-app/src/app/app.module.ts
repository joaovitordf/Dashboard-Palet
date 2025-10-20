import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DashboardEpiComponent } from './dashboard-epi/dashboard-epi.component';
import { DashboardPaletComponent } from './dashboard-palet/dashboard-palet.component';

@NgModule({
  declarations: [AppComponent, DashboardEpiComponent, DashboardPaletComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    CommonModule,
    FormsModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
