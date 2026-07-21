import { Component, signal } from '@angular/core';
import { initFlowbite } from 'flowbite';
import { RouterOutlet } from '@angular/router';
import { MainLayout } from "./shared/layouts/main-layout/main-layout";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MainLayout],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  ngOnInit(): void {
    initFlowbite();
  }
  title = 'usegbe-dashboard';
}
