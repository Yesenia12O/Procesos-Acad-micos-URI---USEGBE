import { Component } from '@angular/core';
import { Navbar } from "../../navbar/navbar";
import { Footer } from "../../footer/footer";
import { CommonModule } from '@angular/common';
import { Hero } from "../../hero/hero";

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [Navbar, Footer, CommonModule, Hero],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {

}
