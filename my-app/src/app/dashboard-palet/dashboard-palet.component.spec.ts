import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardPaletComponent } from './dashboard-palet.component';

describe('DashboardPaletComponent', () => {
  let component: DashboardPaletComponent;
  let fixture: ComponentFixture<DashboardPaletComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DashboardPaletComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardPaletComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
