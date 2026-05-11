---
slug: 21-owen-oreilly
title: Codebase Mapper
students:
  - Owen O'Reilly
tags:
  - developer tools
  - research
category: developer tools
tagline: A vibecoded dependency visualizer for C++ codebases
featuredEligible: true

semester: "Spring 2026"

shortTitle: "Codebase Mapper"
studentId: "116801027"
videoUrl: "https://drive.google.com/file/d/1ZEemwQQ6Usln1oRMRye0oGOsTkXysZxj/view?usp=sharing"
thumbnail: "https://drive.google.com/file/d/1KMf3UVaYoOCnr3K8aABLBEmWdTs8G_I9/view?usp=sharing"
githubUrl: "https://github.com/ReillyO/Codebase_Vis_Final_Project/tree/main"
---


## Problem

Actively developed open source legacy codebases compose a significant portion of contemporary academic research software due both to their transparency of development history and readiness for further feature development by third parties. Work on these codebases, however, tends to be inefficient and complicated. Code that has evolved and been developed by dozens of contributors over the course of years or decades is almost guaranteed to have obscure dependencies, long-range interactions, and archaic load-bearing components. Academia struggles acutely with this issue because standard practices like refactoring are disincentivized by the lack of publishable material resulting from the effort. For the same reasons, developing a standardized and robust set of test cases is often neglected, leading to blind spots for fringe cases. As a result, any new contributors wishing to develop additional features for a given software suite invariably sink disproportionate amounts of time into learning the load-bearing intricacies and dependencies that cannot be disrupted in the area of focus before attempting any contribution to the codebase, and subsequently incorporate their own convolutions due to the intractability of considering the entire codebase in the architectures of their additions. 

## Solution

The implementation consists of a graphical user interface (GUI) to aid developers in understanding the connectivity and interdependencies of a provided codebase. The interface permits the upload of a set of code files in .zip format, displays pertinent connectivity data of the classes contained therein upon user demand, and accepts queries on the dependencies of different components via an interactive search bar. The intention behind the interface is to provide a "bird's-eye" map of the codebase architecture that allows the user to develop a broad understanding of it, as well as sufficient detail on demand that the user can fully map the dependencies of a particular segment they wish to develop. 

## User Flow

0) The user runs either `run.bat` (Windows) or `run.sh` (MacOS/Linux) to generate a Python virtual environment and start the graphical interface and Python backend on localhost
1) The user compresses the desired codebase for inspection into a .zip file format and uploads it to the visualizer using the "Upload Code .zip" button. 
2) Following a short delay for codebase analysis via a Python backend, the user is presented with a set of boxes in the main canvas labelled with file and class names, corresponding to their structure in the codebase. 
3) The user can investigate the codebase architecture and dependencies via the following controls:
 - File boxes can be rearranged via click-and-drag to organize the workspace
 - Classes defined within each file are displayed, and clicking on a class displays the methods defined therein
 - Shift-clicking on a class summons vectors connecting it to other classes that implement it
 - Clicking on a function within a class definition summons vectors showing where that function is called in other classes
 - Activate Physics button allows for quick aggregation of fileboxes linked by vectors in order to analyze clusters of code dependency
 - The search bar on the left of the screen allows for manual queries of a particular method or class of interest
 - Condense button allows for quick reorganization of workspace
 - Show All button displays all connection vectors simultaneously, allowing for quick identification of hubs 

## LLM Components

- The entire frontend and post request infrastructure was vibecoded using Gemini 3 Pro. 

## Tools

- **Frontend:** D3.js, Gemini 3 Pro
- **Hosting:** Vercel
- **Backend:** Python, Flask
- **Video host:** Google Drive (preview embed)
