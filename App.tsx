

import { Header } from './components/Header';
import { findAndAnalyzeBestArticleFromList } from './services/gemini';
import { fetchLatestBangladeshiNews } from './services/news';
import { composeImage, loadImage } from './utils/canvas';
import { LOGO_URL, BRAND_TEXT, OVERLAY_IMAGE_URL, NEWS_CATEGORIES, API_FETCH_DELAY_MS, APP_PASSWORD } from './constants';
import { BatchTask, TaskStatus, WebhookPayload, NewsAnalysis, NewsDataArticle, StatusWebhookPayload, LogEntry } from './types';
import { uploadToCloudinary } from './services/cloudinary';
import { sendToMakeWebhook, sendStatusUpdate } from './services/webhook';
import { BatchStatusDisplay } from './components/BatchStatusDisplay';
import { generateImageFromPrompt } from './services/imageGenerator';
import { PasswordScreen } from './components/PasswordScreen';
import { LogPanel } from './components/LogPanel';

interface CollectedData {
    taskId: string;
    analysis: NewsAnalysis;
    article: NewsDataArticle;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hasTriggeredFromUrl, setHasTriggeredFromUrl] = useState(false);
  
  const isProcessingRef = useRef(isProcessing);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const log = useCallback((data: Omit<LogEntry, 'timestamp'>) => {
    const newLogEntry: LogEntry = {
        ...data,
        timestamp: new Date().toISOString(),
    };
    setLogs(prevLogs => [...prevLogs, newLogEntry]);
    sendStatusUpdate(data);
  }, []);

  const handleStartAutomation = useCallback(async () => {
    log({ level: 'INFO', message: 'Automation process started by trigger.' });
    setIsProcessing(true);
    setCompletedCount(0);
    
    const initialTasks: BatchTask[] = NEWS_CATEGORIES.map(cat => ({
        id: cat.apiValue,
        categoryName: cat.name,
        status: TaskStatus.PENDING,
    }));
    setTasks(initialTasks);

    const usedArticleLinks = new Set<string>();

    const updateTask = (taskId: string, updates: Partial<BatchTask>) => {
        setTasks(prevTasks => prevTasks.map(task => 
            task.id === taskId ? { ...task, ...updates } : task
        ));
    };
    
    // --- PHASE 1: GATHER ALL NEWS ARTICLES ---
    const collectedData: CollectedData[] = [];
    log({ level: 'INFO', message: 'Starting Phase 1: Article Gathering.' });

    for (const category of NEWS_CATEGORIES) {
        const taskId = category.apiValue;
        try {
            updateTask(taskId, { status: TaskStatus.GATHERING });
            log({ level: 'INFO', message: `Gathering for: ${category.name}`, category: category.name });

            let allArticles: NewsDataArticle[];

            if (category.apiValue === 'top') {
                log({ level: 'INFO', message: 'Creating synthetic "Trending" category.', category: category.name });
                const otherCategoryValues = NEWS_CATEGORIES
                    .filter(c => c.apiValue !== 'top')
                    .map(c => c.apiValue);

                const articlesFromAllCategories = (await Promise.all(
                    otherCategoryValues.map(cat => fetchLatestBangladeshiNews(cat))
                )).flat();

                const uniqueArticles = Array.from(new Map(articlesFromAllCategories.map(article => [article.link, article])).values());
                
                uniqueArticles.sort((a, b) => {
                    if (!a.pubDate || !b.pubDate) return 0;
                    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
                });
                
                allArticles = uniqueArticles.slice(0, 10);
                
                if (allArticles.length === 0) throw new Error('Could not construct "Trending" category.');
                log({ level: 'INFO', message: `Found ${allArticles.length} articles for "Trending".`, category: category.name});

            } else {
                 allArticles = await fetchLatestBangladeshiNews(category.apiValue);
            }
            
            const unusedArticles = allArticles.filter(article => !usedArticleLinks.has(article.link));

            if (unusedArticles.length === 0) throw new Error(`No new, unused articles found.`);
            
            log({ level: 'INFO', message: `Found ${unusedArticles.length} new articles. Analyzing...`, category: category.name });
            const result = await findAndAnalyzeBestArticleFromList(unusedArticles);
            
            if (!result) throw new Error(`AI deemed all articles irrelevant.`);
            
            const { analysis, article: relevantArticle } = result;
            usedArticleLinks.add(relevantArticle.link);
            collectedData.push({ taskId, analysis, article: relevantArticle });
            
            updateTask(taskId, { status: TaskStatus.GATHERED });
            log({ level: 'SUCCESS', message: `Article gathered and analyzed.`, category: category.name, details: { headline: analysis.headline, source: relevantArticle.link }});

            if (API_FETCH_DELAY_MS > 0) {
                await new Promise(resolve => setTimeout(resolve, API_FETCH_DELAY_MS));
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            console.error(`Failed to gather article for category ${category.name}:`, err);
            updateTask(taskId, { status: TaskStatus.ERROR, error: errorMessage });
            log({ level: 'ERROR', message: `Gathering failed: ${errorMessage}`, category: category.name });
        }
    }

    // --- PHASE 2: PROCESS ALL GATHERED ARTICLES ---
    log({ level: 'INFO', message: `Gathering finished. Processing ${collectedData.length} articles.` });
    for (const data of collectedData) {
        const { taskId, analysis, article } = data;
        const categoryName = NEWS_CATEGORIES.find(c => c.apiValue === taskId)?.name || taskId;

        try {
            updateTask(taskId, { status: TaskStatus.PROCESSING });
            
            let imageToCompose: HTMLImageElement;
            try {
                imageToCompose = await loadImage(article.image_url!);
                log({ level: 'INFO', message: 'Article image loaded.', category: categoryName });
            } catch (error) {
                log({ level: 'INFO', message: `Article image failed. Generating new one.`, category: categoryName, details: { error: error instanceof Error ? error.message : String(error) }});
                updateTask(taskId, { status: TaskStatus.GENERATING_IMAGE });
                const generatedImageBase64 = await generateImageFromPrompt(analysis.imagePrompt);
                imageToCompose = await loadImage(generatedImageBase64);
            }

            updateTask(taskId, { status: TaskStatus.COMPOSING });
            log({ level: 'INFO', message: 'Composing final image.', category: categoryName });
            const compiledImage = await composeImage(
              imageToCompose,
              analysis.headline,
              analysis.highlightPhrases,
              LOGO_URL,
              BRAND_TEXT,
              OVERLAY_IMAGE_URL
            );

            updateTask(taskId, { status: TaskStatus.UPLOADING });
            log({ level: 'INFO', message: 'Uploading to Cloudinary.', category: categoryName });
            const imageUrl = await uploadToCloudinary(compiledImage);

            updateTask(taskId, { status: TaskStatus.SENDING_WEBHOOK });
            log({ level: 'INFO', message: 'Sending to workflow.', category: categoryName });
            const webhookPayload: WebhookPayload = {
                headline: analysis.headline,
                imageUrl: imageUrl,
                summary: analysis.caption,
                newsLink: article.link,
                status: 'Queue'
            };
            await sendToMakeWebhook(webhookPayload);
            
            updateTask(taskId, { 
                status: TaskStatus.DONE,
                result: {
                    headline: analysis.headline,
                    imageUrl: imageUrl,
                    caption: analysis.caption,
                    sourceUrl: article.link,
                    sourceName: analysis.sourceName,
                }
            });
            setCompletedCount(prev => prev + 1);
            log({ level: 'SUCCESS', message: 'Task completed successfully!', category: categoryName, details: { headline: analysis.headline }});

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            console.error(`Failed task for category ${categoryName}:`, err);
            updateTask(taskId, { status: TaskStatus.ERROR, error: errorMessage });
            log({ level: 'ERROR', message: `Processing failed: ${errorMessage}`, category: categoryName });
        }
    }

    setIsProcessing(false);
    log({ level: 'SUCCESS', message: 'Automation process finished.' });
  }, [log]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('action') === 'start' && !hasTriggeredFromUrl && !isProcessingRef.current) {
        
        const handleAuthAndStart = () => {
            console.log('Start action triggered from URL.');
            setHasTriggeredFromUrl(true);
            setIsAuthenticated(true);
            // Use timeout to allow state to update before starting automation
            setTimeout(handleStartAutomation, 0); 
        };
        
        // If password is in constants, check it. Otherwise, just authenticate.
        if (APP_PASSWORD) {
            const providedPassword = urlParams.get('password');
            if (providedPassword === APP_PASSWORD) {
                handleAuthAndStart();
            } else {
                console.log('URL trigger failed: incorrect or missing password.');
                // Optionally show an error or just remain on the password screen
            }
        } else {
            handleAuthAndStart();
        }
      }
    }
  }, [handleStartAutomation, hasTriggeredFromUrl]);


  if (!isAuthenticated) {
    return <PasswordScreen onSuccess={() => setIsAuthenticated(true)} onLog={log} />;
  }

  const overallProgress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-200 text-black p-4 md:p-8 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-7xl mx-auto">
        
        {/* Main Content Column */}
        <div className="lg:col-span-3 space-y-8">
          <Header />

          <div className="p-8 bg-yellow-300 border-4 border-black rounded-xl neo-shadow">
            <h2 className="text-3xl font-black text-center">Generate Post Batch</h2>
            <p className="mt-2 text-gray-800 max-w-2xl mx-auto text-center font-medium">
              Click the button to fetch, analyze, and process news content for all categories.
            </p>
            <div className="mt-8 text-center">
              <button
                onClick={handleStartAutomation}
                disabled={isProcessing}
                className="bg-pink-500 text-white font-bold px-10 py-4 rounded-lg border-4 border-black neo-shadow-sm btn-neo disabled:bg-gray-500 disabled:cursor-not-allowed disabled:text-gray-300 transition-all duration-300 text-xl"
              >
                {isProcessing ? `PROCESSING... (${completedCount}/${tasks.length})` : 'START AUTOMATION'}
              </button>
            </div>
             {isProcessing && (
                <div className="w-full bg-black/20 rounded-full h-4 mt-8 border-2 border-black">
                    <div className="bg-pink-500 h-full rounded-full" style={{ width: `${overallProgress}%`, transition: 'width 0.5s ease-in-out' }}></div>
                </div>
            )}
          </div>

          {tasks.length > 0 && (
             <BatchStatusDisplay tasks={tasks} />
          )}

        </div>
        
        {/* Log Panel Column */}
        <div className="lg:col-span-2">
          <LogPanel logs={logs} />
        </div>
      </div>
    </div>
  );
};

export default App;
