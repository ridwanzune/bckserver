
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { selectAndAnalyzeSixBestArticles, translateArticlesToEnglish } from './services/gemini';
import { fetchAllNewsFromSources } from './services/news';
import { composeImage, loadImage } from './components/utils/canvas';
import { LOGO_URL, BRAND_TEXT, OVERLAY_IMAGE_URL, NEWS_CATEGORIES, APP_PASSWORD } from './components/utils/constants';
import { BatchTask, TaskStatus, WebhookPayload, LogEntry, TaskResult, SelectedArticleAnalysis } from './types';
import { uploadToCloudinary } from './cloudinary';
import { sendToMakeWebhook, sendStatusUpdate, sendFinalBundle } from './services/webhook';
import { BatchStatusDisplay } from './components/BatchStatusDisplay';
import { generateImageFromPrompt } from './services/imageGenerator';
import { LogPanel } from './components/utils/LogPanel';
import { PasswordScreen } from './components/PasswordScreen';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!APP_PASSWORD);
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hasTriggeredFromUrl, setHasTriggeredFromUrl] = useState(false);
  
  const isProcessingRef = useRef(isProcessing);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    // This effect runs once on mount to check for URL-based authentication.
    if (!isAuthenticated && typeof window !== 'undefined' && APP_PASSWORD) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('password') === APP_PASSWORD) {
            console.log('Authenticated via URL parameter.');
            setIsAuthenticated(true);
        }
    }
  }, [isAuthenticated]);

  const log = useCallback((data: Omit<LogEntry, 'timestamp'>) => {
    const newLogEntry: LogEntry = {
        ...data,
        timestamp: new Date().toISOString(),
    };
    setLogs(prevLogs => [...prevLogs, newLogEntry]);
    sendStatusUpdate(data);
  }, []);
  
  const updateTask = useCallback((taskId: string, updates: Partial<BatchTask>) => {
      setTasks(prevTasks => prevTasks.map(task => 
          task.id === taskId ? { ...task, ...updates } : task
      ));
  }, []);

  const updateTaskStatusForAll = useCallback((status: TaskStatus) => {
    setTasks(prevTasks => prevTasks.map(task => ({ ...task, status })));
  }, []);

  const handleStartAutomation = useCallback(async () => {
    log({ level: 'INFO', message: 'Automation process started.' });
    setIsProcessing(true);
    setCompletedCount(0);
    const allResults: TaskResult[] = [];
    
    const initialTasks: BatchTask[] = NEWS_CATEGORIES.map(cat => ({
        id: cat.id,
        categoryName: cat.name,
        status: TaskStatus.PENDING,
    }));
    setTasks(initialTasks);

    try {
        // --- PHASE 1: GATHER ALL NEWS ---
        log({ level: 'INFO', message: 'Gathering a large pool of articles from all sources...' });
        updateTaskStatusForAll(TaskStatus.GATHERING);
        
        const allArticles = await fetchAllNewsFromSources();
        log({ level: 'SUCCESS', message: `Successfully gathered ${allArticles.length} unique articles.` });

        // --- NEW PHASE 1.5: TRANSLATE ARTICLES ---
        log({ level: 'INFO', message: 'Translating articles to English for consistent analysis...' });
        const translatedArticles = await translateArticlesToEnglish(allArticles);
        log({ level: 'SUCCESS', message: `Translation complete. Pool of ${translatedArticles.length} articles is ready.` });


        // --- PHASE 2: SINGLE AI ANALYSIS ---
        log({ level: 'INFO', message: `Sending article pool of ${translatedArticles.length} articles to AI for selection and analysis...` });
        updateTaskStatusForAll(TaskStatus.PROCESSING);

        const analyzedResults: SelectedArticleAnalysis[] = await selectAndAnalyzeSixBestArticles(translatedArticles);
        log({ level: 'SUCCESS', message: `AI has selected and analyzed ${analyzedResults.length} articles.` });
        
        // --- PHASE 3: PROCESS RESULTS ---
        // Map AI results to the original task IDs. This ensures we fill the correct UI slots.
        const taskSlotMap = new Map<string, BatchTask[]>();
        NEWS_CATEGORIES.forEach(cat => {
            const slots = taskSlotMap.get(cat.type) || [];
            slots.push(initialTasks.find(t => t.id === cat.id)!);
            taskSlotMap.set(cat.type, slots);
        });

        const processedTaskIds = new Set<string>();

        for (const analyzed of analyzedResults) {
            const originalArticle = translatedArticles[analyzed.originalArticleId];
            if (!originalArticle) {
                log({ level: 'ERROR', message: `AI returned an invalid article ID: ${analyzed.originalArticleId}` });
                continue;
            }

            const availableSlots = taskSlotMap.get(analyzed.category)?.filter(t => !processedTaskIds.has(t.id));
            if (!availableSlots || availableSlots.length === 0) {
                 log({ level: 'ERROR', message: `AI returned an article for category '${analyzed.category}', but all slots are already filled.` });
                continue;
            }
            const taskToUpdate = availableSlots[0];
            processedTaskIds.add(taskToUpdate.id);

            const { id: taskId, categoryName } = taskToUpdate;
            const analysis = analyzed;
            
            try {
                let imageToCompose: HTMLImageElement;
                try {
                    if (!originalArticle.image_url) throw new Error("Article has no image_url.");
                    updateTask(taskId, { status: TaskStatus.PROCESSING });
                    imageToCompose = await loadImage(originalArticle.image_url);
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
                    headline: analysis.headline, imageUrl, summary: analysis.caption,
                    newsLink: originalArticle.link, status: 'Queue'
                };
                await sendToMakeWebhook(webhookPayload);
                
                const finalResult: TaskResult = {
                    headline: analysis.headline, imageUrl, caption: analysis.caption,
                    sourceUrl: originalArticle.link, sourceName: analysis.sourceName,
                };

                updateTask(taskId, { status: TaskStatus.DONE, result: finalResult });
                allResults.push(finalResult);
                setCompletedCount(prev => prev + 1);
                log({ level: 'SUCCESS', message: 'Task completed successfully!', category: categoryName, details: { headline: analysis.headline }});

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                console.error(`Failed processing task for category ${categoryName}:`, err);
                updateTask(taskId, { status: TaskStatus.ERROR, error: errorMessage });
                log({ level: 'ERROR', message: `Processing failed: ${errorMessage}`, category: categoryName });
            }
        }
        
        // Mark any tasks that didn't get assigned a result as errors
        initialTasks.forEach(task => {
            if (!processedTaskIds.has(task.id)) {
                updateTask(task.id, { status: TaskStatus.ERROR, error: "AI did not select an article for this slot." });
            }
        });

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "A critical error occurred in the main process.";
        log({ level: 'ERROR', message: `Automation failed critically: ${errorMessage}` });
        setTasks(prevTasks => prevTasks.map(t => t.status !== TaskStatus.DONE ? { ...t, status: TaskStatus.ERROR, error: "Process failed" } : t));
    } finally {
        setIsProcessing(false);
        log({ level: 'SUCCESS', message: 'Automation process finished.' });
        if (allResults.length > 0) {
            try {
                log({ level: 'INFO', message: `Sending final bundle of ${allResults.length} content pieces to webhook.` });
                await sendFinalBundle(allResults);
                log({ level: 'SUCCESS', message: 'Final bundle sent successfully.' });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
                log({ level: 'ERROR', message: `Failed to send final content bundle: ${errorMessage}` });
            }
        } else {
            log({ level: 'INFO', message: 'No successful content was generated to be sent in the final bundle.' });
        }
    }
  }, [log, updateTask, updateTaskStatusForAll]);

  useEffect(() => {
    // This effect handles URL-triggered automation, but only if authenticated.
    if (isAuthenticated && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('action') === 'start' && !hasTriggeredFromUrl && !isProcessingRef.current) {
        console.log('Start action triggered from URL.');
        setHasTriggeredFromUrl(true);
        setTimeout(handleStartAutomation, 0); 
      }
    }
  }, [isAuthenticated, handleStartAutomation, hasTriggeredFromUrl]);

  const overallProgress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  if (!isAuthenticated) {
    return <PasswordScreen onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-200 text-black p-4 md:p-8 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-7xl mx-auto">
        
        {/* Main Content Column */}
        <div className="lg:col-span-3 space-y-8">
          <Header />

          <div className="p-8 bg-yellow-300 border-4 border-black rounded-xl neo-shadow">
            <h2 className="text-3xl font-black text-center">Generate Post Batch</h2>
            <p className="mt-2 text-gray-800 max-w-2xl mx-auto text-center font-medium">
              Click the button to fetch, analyze, and process news content for all categories. This will generate 6 unique pieces of content.
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
