"use client";

import { uploadedFiles, courses } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Upload,
  FileText,
  File,
  FileSpreadsheet,
  Presentation,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  X,
  Filter,
  Search,
  Info,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const fileTypeIcons: Record<string, React.ElementType> = {
  slides: Presentation,
  homework: FileSpreadsheet,
  exam: FileText,
  practice: File,
  notes: FileText,
};

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  indexed: { color: "text-emerald-500 bg-emerald-500/10", icon: CheckCircle2 },
  parsing: { color: "text-yellow-500 bg-yellow-500/10", icon: Loader2 },
  uploaded: { color: "text-blue-500 bg-blue-500/10", icon: Clock },
  error: { color: "text-red-500 bg-red-500/10", icon: AlertCircle },
};

export default function UploadsPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFiles = uploadedFiles.filter((file) => {
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(file.type);
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Mock file upload handling
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Upload Materials</h1>
          <p className="text-muted-foreground">
            Add course materials to build your Professor Profile
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select className="h-10 rounded-lg border border-input bg-secondary px-4 text-sm">
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name} - {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Drop files here or click to upload
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Supports PDF, PPTX, DOCX, and image files up to 50MB
            </p>
            <Button className="mt-6">
              <Upload className="mr-2 h-4 w-4" />
              Select Files
            </Button>
          </div>

          {/* Scope Controls */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Scope Controls</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Fine-tune which content to include in your Professor Profile
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-foreground">Focus Topics</label>
                  <input
                    type="text"
                    placeholder="e.g., hypothesis testing, confidence intervals"
                    className="mt-1 h-10 w-full rounded-lg border border-input bg-secondary/50 px-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-foreground">Lecture Range</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="From (e.g., 3)"
                      className="h-10 w-full rounded-lg border border-input bg-secondary/50 px-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                    <span className="text-muted-foreground">to</span>
                    <input
                      type="text"
                      placeholder="To (e.g., 8)"
                      className="h-10 w-full rounded-lg border border-input bg-secondary/50 px-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-input" />
                  <span className="text-sm text-foreground">Exclude homework solutions</span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-input" />
                  <span className="text-sm text-foreground">Prioritize prior exams</span>
                </label>
              </div>
            </div>
          </div>

          {/* File List */}
          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-semibold text-foreground">Uploaded Files</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search files..."
                    className="h-9 w-48 rounded-lg border border-input bg-secondary/50 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="mr-2 h-4 w-4" />
                      Filter
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {["slides", "homework", "exam", "practice", "notes"].map((type) => (
                      <DropdownMenuCheckboxItem
                        key={type}
                        checked={selectedTypes.includes(type)}
                        onCheckedChange={(checked) => {
                          setSelectedTypes(
                            checked
                              ? [...selectedTypes, type]
                              : selectedTypes.filter((t) => t !== type)
                          );
                        }}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="divide-y divide-border">
              {filteredFiles.map((file) => {
                const FileIcon = fileTypeIcons[file.type] || FileText;
                const status = statusConfig[file.status];
                const StatusIcon = status.icon;
                
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {file.type} · {file.size} · {file.uploadedAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
                        <StatusIcon className={`h-3.5 w-3.5 ${file.status === "parsing" ? "animate-spin" : ""}`} />
                        {file.status}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Info Panel */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Recommended Uploads</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="font-medium text-foreground">Prior Exams</p>
                  <p className="text-muted-foreground">
                    Most valuable for building accurate professor profiles
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                <div>
                  <p className="font-medium text-foreground">Lecture Slides</p>
                  <p className="text-muted-foreground">
                    Helps identify topic emphasis and coverage
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-chart-4" />
                <div>
                  <p className="font-medium text-foreground">Homework Sets</p>
                  <p className="text-muted-foreground">
                    Reveals problem types and difficulty patterns
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Practice Tests</p>
                  <p className="text-muted-foreground">
                    Additional signals for exam structure
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Stats */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Upload Statistics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Files</span>
                <span className="font-medium text-foreground">{uploadedFiles.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Indexed</span>
                <span className="font-medium text-emerald-500">
                  {uploadedFiles.filter((f) => f.status === "indexed").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Processing</span>
                <span className="font-medium text-yellow-500">
                  {uploadedFiles.filter((f) => f.status === "parsing").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pending</span>
                <span className="font-medium text-muted-foreground">
                  {uploadedFiles.filter((f) => f.status === "uploaded").length}
                </span>
              </div>
            </div>
          </div>

          {/* Supported Formats */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Supported Formats</h3>
            <div className="flex flex-wrap gap-2">
              {["PDF", "PPTX", "DOCX", "PNG", "JPG", "TXT"].map((format) => (
                <span
                  key={format}
                  className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  {format}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
