import { useState, useEffect, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getUserDocuments, saveDocument, generateId } from "@/lib/localStorage";
import { importDocument } from "@/lib/backup";
import { useToast } from "@/hooks/use-toast";
 

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [recentProjects, setRecentProjects] = useState<Array<{
    id: string;
    title: string;
    description: string;
    lastModified: string;
    author: string;
  }>>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const importDocInputRef = useRef<HTMLInputElement>(null);
  

  // Load projects from localStorage
  const loadProjects = () => {
    if (!user) return;

    const documents = getUserDocuments(user.id);
    const sorted = documents.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );

    setRecentProjects(
      sorted.map((doc) => ({
        id: doc.id,
        title: doc.title,
        description: doc.description || "No description",
        lastModified: new Date(doc.lastModified).toLocaleString(),
        author: user.mobileNumber || "User",
      }))
    );
  };

  useEffect(() => {
    loadProjects();
  }, [user]);

  

  const handleImportDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const document = await importDocument(file);
      // Generate new ID and update user ID
      const newDocument = {
        ...document,
        id: generateId(),
        userId: user.id,
        lastModified: new Date().toISOString(),
      };
      saveDocument(newDocument);
      loadProjects();
      toast({
        title: "Document Imported",
        description: `Successfully imported "${document.title}".`,
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import document. Please check the file format.",
        variant: "destructive",
      });
    }
    
    // Reset input
    if (importDocInputRef.current) {
      importDocInputRef.current.value = '';
    }
  };

  
  return <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-hero py-20 text-primary-foreground">
        <div className="container relative z-10 px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight">
              Documentation Builder
            </h1>
            <p className="mb-8 text-lg opacity-90">
              Create, edit, and publish comprehensive technical documentation with ease.
              Build structured documents with our intuitive interface.
            </p>
            <div className="flex justify-center">
              <Link to="/editor/new">
                <Button variant="secondary" size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  New Document
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:30px_30px]" />
      </section>

      {/* Features Section */}
      <section className="py-12 border-b">
        <div className="container px-4">
          
        </div>
      </section>

      {/* Recent Projects Section */}
      <section className="py-12">
        <div className="container px-4">
          <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-3xl font-bold">Recent Projects</h2>
            <div className="flex items-center gap-2">
              <input
                ref={importDocInputRef}
                type="file"
                accept=".json"
                onChange={handleImportDocument}
                className="hidden"
              />
              <Button
                variant="default"
                size="default"
                onClick={() => importDocInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Import Project
              </Button>
            </div>
          </div>
          <div className="mb-4 relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" placeholder="Search projects..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map(project => <ProjectCard key={project.id} {...project} onUpdate={loadProjects} />)}
          </div>

          {recentProjects.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-4 h-16 w-16 text-muted-foreground/50" />
              <h3 className="mb-2 text-xl font-semibold">No projects yet</h3>
              <p className="mb-6 text-muted-foreground">
                Get started by creating your first documentation project
              </p>
              <Link to="/editor/new">
                <Button variant="hero" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Create Your First Project
                </Button>
              </Link>
            </div>}
        </div>
      </section>
      
    </div>;
};
export default Index;