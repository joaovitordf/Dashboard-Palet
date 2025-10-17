import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardEpiComponent } from './dashboard-epi.component';

describe('DashboardEpiComponent', () => {
  let component: DashboardEpiComponent;
  let fixture: ComponentFixture<DashboardEpiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DashboardEpiComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardEpiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
