import { useParams, useNavigate } from 'react-router-dom';
import { dummyProjects } from '@/data/dummyProjects';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const LabelVisualization = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = dummyProjects.find((p) => p.id === projectId);

  if (!project) {
    return <div>Project not found</div>;
  }

  // Mock data for visualizations
  const labelFrequency = project.axial_codes?.map((code) => ({
    name: code.name,
    count: Math.floor(Math.random() * 20) + 5,
    color: code.color,
  })) || [];

  const totalLabels = labelFrequency.reduce((sum, label) => sum + label.count, 0);

  const ratingDistribution = [
    { rating: 1, labels: Math.floor(Math.random() * 15) + 5 },
    { rating: 2, labels: Math.floor(Math.random() * 20) + 10 },
    { rating: 3, labels: Math.floor(Math.random() * 25) + 15 },
    { rating: 4, labels: Math.floor(Math.random() * 20) + 10 },
    { rating: 5, labels: Math.floor(Math.random() * 15) + 5 },
  ];

  const labelingProgress = Math.round((project.labeled_count / project.conversations.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${projectId}`)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Label Visualization</h1>
                <p className="text-sm text-muted-foreground mt-1">{project.project_name}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progress Tracker */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Labeling Progress</CardTitle>
              <CardDescription>
                {project.labeled_count} of {project.conversations.length} conversations labeled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Progress value={labelingProgress} className="h-3" />
                <p className="text-sm text-muted-foreground text-right">{labelingProgress}% Complete</p>
              </div>
            </CardContent>
          </Card>

          {/* Label Frequency */}
          <Card>
            <CardHeader>
              <CardTitle>Label Frequency</CardTitle>
              <CardDescription>Distribution of axial codes across conversations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {labelFrequency.map((label) => (
                  <div key={label.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="font-medium">{label.name}</span>
                      </div>
                      <span className="text-muted-foreground">{label.count}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          backgroundColor: label.color,
                          width: `${(label.count / totalLabels) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Donut Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Label Distribution</CardTitle>
              <CardDescription>Proportion of each label type</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  {labelFrequency.reduce((acc, label, index) => {
                    const percentage = (label.count / totalLabels) * 100;
                    const offset = acc.offset;
                    acc.offset += percentage;
                    return {
                      ...acc,
                      elements: [
                        ...acc.elements,
                        <circle
                          key={label.name}
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke={label.color}
                          strokeWidth="20"
                          strokeDasharray={`${percentage * 2.51327} ${251.327 - percentage * 2.51327}`}
                          strokeDashoffset={-offset * 2.51327}
                          className="transition-all"
                        />,
                      ],
                    };
                  }, { offset: 0, elements: [] as JSX.Element[] }).elements}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{totalLabels}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rating vs Labels */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Labels vs Customer Satisfaction</CardTitle>
              <CardDescription>Distribution of labels by customer rating</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ratingDistribution.map((item) => (
                  <div key={item.rating} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium">
                      Rating {item.rating}
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-secondary rounded-full h-8 flex items-center">
                        <div
                          className="bg-primary h-8 rounded-full flex items-center justify-end px-3 transition-all"
                          style={{
                            width: `${(item.labels / Math.max(...ratingDistribution.map(r => r.labels))) * 100}%`,
                          }}
                        >
                          <span className="text-xs font-medium text-primary-foreground">
                            {item.labels}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Open Code Relationships */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Open Code Relationships</CardTitle>
              <CardDescription>Network visualization of code co-occurrence</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-64">
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Simple scatter plot visualization */}
                <svg viewBox="0 0 400 200" className="w-full h-full">
                  {labelFrequency.map((label, index) => {
                    const x = 50 + (index * 300) / Math.max(labelFrequency.length - 1, 1);
                    const y = 100 + (Math.random() - 0.5) * 60;
                    return (
                      <g key={label.name}>
                        <circle
                          cx={x}
                          cy={y}
                          r={Math.sqrt(label.count) * 3}
                          fill={label.color}
                          opacity="0.6"
                        />
                        <text
                          x={x}
                          y={y + Math.sqrt(label.count) * 3 + 12}
                          textAnchor="middle"
                          className="text-xs fill-current"
                        >
                          {label.name}
                        </text>
                      </g>
                    );
                  })}
                  {/* Draw connections */}
                  {labelFrequency.map((_, i) => {
                    if (i < labelFrequency.length - 1) {
                      const x1 = 50 + (i * 300) / Math.max(labelFrequency.length - 1, 1);
                      const x2 = 50 + ((i + 1) * 300) / Math.max(labelFrequency.length - 1, 1);
                      return (
                        <line
                          key={`line-${i}`}
                          x1={x1}
                          y1={100}
                          x2={x2}
                          y2={100}
                          stroke="currentColor"
                          strokeWidth="1"
                          opacity="0.2"
                        />
                      );
                    }
                    return null;
                  })}
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default LabelVisualization;
