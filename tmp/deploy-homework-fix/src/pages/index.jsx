import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Link } from '@remix-run/react'
import {
  BookOpen,
  Building2,
  ChevronRight,
  GraduationCap,
  LayoutGrid,
  MapPin,
  MonitorPlay,
  School,
  Users,
  Play,
  Star,
  Award,
  Globe,
  Zap,
  Shield,
  Menu,
} from 'lucide-react'

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const schools = [
    {
      zone: 'Srinagar',
      constituency: 'Lal Chowk',
      name: 'Boys Middle School Rajbagh',
      code: '01030100602',
    },
    {
      zone: 'Hawal',
      constituency: 'Zadibal',
      name: 'Boys Middle School Soura',
      code: '01030101901',
    },
    {
      zone: 'Gulab bagh',
      constituency: 'Hazratbal',
      name: 'BMS Zakura',
      code: '01030700604',
    },
    {
      zone: 'Rainawari',
      constituency: 'Hazratbal',
      name: 'BMS Panjkerwari',
      code: '01031001606',
    },
    {
      zone: 'Batamaloo',
      constituency: 'Khanyar',
      name: 'GMS Saidakdal',
      code: '01031001213',
    },
    {
      zone: 'Eidgah',
      constituency: 'Iddgah',
      name: 'GMS Barzulla',
      code: '01030300702',
    },
    {
      zone: 'Nishat',
      constituency: 'Central Shalteng',
      name: 'BMS Batamaloo',
      code: '01030401801',
    },
    {
      zone: 'Zaldagar',
      constituency: 'Central Shalteng',
      name: 'MS Khojabagh Maloora',
      code: '01030400102',
    },
    {
      zone: 'Lal Chowk',
      constituency: 'Iddgah',
      name: 'BMS NOorbagh',
      code: '01030401202',
    },
    {
      zone: 'Channapora',
      constituency: 'Khanyar',
      name: 'MS Kreshbal',
      code: '01030800504',
    },
    {
      zone: 'Nowgam',
      constituency: 'Iddgah',
      name: 'GMS New Theed',
      code: '01030800928',
    },
    {
      zone: 'Habba Kadal',
      constituency: 'Habba Kadal',
      name: 'BMS Q, D Pora',
      code: '01030901102',
    },
  ]

  return (
    <div className='flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-muted/20'>
      <header className='sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm'>
        <div className='container mx-auto flex h-16 items-center justify-between px-4 lg:px-6'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg'>
              <GraduationCap className='h-5 w-5' />
            </div>
            <div className='flex flex-col'>
              <span className='text-xl font-bold leading-none'>Learn Srinagar</span>
              <span className='text-xs text-muted-foreground'>Transforming Education</span>
            </div>
          </div>
          <nav className='hidden md:flex items-center gap-8'>
            <button
              onClick={() => document.getElementById('impact')?.scrollIntoView({ behavior: 'smooth' })}
              className='relative text-base font-semibold text-muted-foreground transition-all duration-300 hover:text-primary hover:scale-110 group'
            >
              Impact
              <span className='absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full'></span>
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className='relative text-base font-semibold text-muted-foreground transition-all duration-300 hover:text-primary hover:scale-110 group'
            >
              Features
              <span className='absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full'></span>
            </button>
            <button
              onClick={() => document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' })}
              className='relative text-base font-semibold text-muted-foreground transition-all duration-300 hover:text-primary hover:scale-110 group'
            >
              Mission
              <span className='absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full'></span>
            </button>
            <button
              onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })}
              className='relative text-base font-semibold text-muted-foreground transition-all duration-300 hover:text-primary hover:scale-110 group'
            >
              Schools
              <span className='absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full'></span>
            </button>
            <Link to='/blogs' className='relative text-base font-semibold text-muted-foreground transition-all duration-300 hover:text-primary hover:scale-110 group'>
              Blog
              <span className='absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full'></span>
            </Link>
          </nav>
          <div className='flex items-center gap-3'>
            <Link to='/login' className='hidden sm:block'>
              <Button size='sm' className='shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105'>
                <Users className='mr-2 h-4 w-4' />
                Login
              </Button>
            </Link>
            
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant='ghost' size='sm' className='md:hidden'>
                  <Menu className='h-5 w-5' />
                </Button>
              </SheetTrigger>
              <SheetContent side='right' className='w-80'>
                <div className='flex flex-col gap-6 mt-6'>
                  <div className='flex items-center gap-3 pb-4 border-b'>
                    <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground'>
                      <GraduationCap className='h-5 w-5' />
                    </div>
                    <div>
                      <span className='text-lg font-bold'>Learn Srinagar</span>
                      <p className='text-xs text-muted-foreground'>Transforming Education</p>
                    </div>
                  </div>
                  
                  <nav className='flex flex-col gap-4'>
                    <button
                      onClick={() => {
                        document.getElementById('impact')?.scrollIntoView({ behavior: 'smooth' })
                        setMobileMenuOpen(false)
                      }}
                      className='flex items-center gap-3 text-left p-3 rounded-lg hover:bg-muted transition-colors'
                    >
                      <Award className='h-5 w-5 text-primary' />
                      <span className='font-medium'>Impact</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                        setMobileMenuOpen(false)
                      }}
                      className='flex items-center gap-3 text-left p-3 rounded-lg hover:bg-muted transition-colors'
                    >
                      <Zap className='h-5 w-5 text-primary' />
                      <span className='font-medium'>Features</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' })
                        setMobileMenuOpen(false)
                      }}
                      className='flex items-center gap-3 text-left p-3 rounded-lg hover:bg-muted transition-colors'
                    >
                      <Globe className='h-5 w-5 text-primary' />
                      <span className='font-medium'>Mission</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })
                        setMobileMenuOpen(false)
                      }}
                      className='flex items-center gap-3 text-left p-3 rounded-lg hover:bg-muted transition-colors'
                    >
                      <School className='h-5 w-5 text-primary' />
                      <span className='font-medium'>Schools</span>
                    </button>
                    
                    <Link 
                      to='/blogs' 
                      className='flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors'
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <BookOpen className='h-5 w-5 text-primary' />
                      <span className='font-medium'>Blog</span>
                    </Link>
                  </nav>
                  
                  <div className='mt-auto pt-6 border-t'>
                    <Link to='/login' onClick={() => setMobileMenuOpen(false)}>
                      <Button className='w-full'>
                        <Users className='mr-2 h-4 w-4' />
                        Login to Portal
                      </Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className='flex-1'>
        {/* Hero Section */}
        <section className='relative w-full py-16 md:py-24 overflow-hidden'>
          <div className='absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10'></div>
          <div className='container mx-auto px-4 md:px-6 relative'>
            <div className='grid gap-8 lg:grid-cols-2 lg:gap-16 items-center'>
              <div className='flex flex-col justify-center space-y-6 text-center lg:text-left'>
                <div className='space-y-4'>
                  <div className='inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary'>
                    
                    Transforming Education in Kashmir
                  </div>
                  <h1 className='text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl'>
                    Connecting
                    <span className='block text-primary'>Classrooms</span>
                    Across Distances
                  </h1>
                  <p className='max-w-[600px] text-lg text-muted-foreground md:text-xl mx-auto lg:mx-0'>
                    Learn Srinagar bridges educational gaps through innovative hybrid learning, 
                    connecting schools across Kashmir with expert teachers and interactive sessions.
                  </p>
                </div>
                <div className='flex flex-col sm:flex-row gap-4 justify-center lg:justify-start'>
                  <Link to='/login'>
                    <Button size='lg' className='group shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto'>
                      <Users className='mr-2 h-5 w-5 group-hover:scale-110 transition-transform' />
                      Log In to Portal
                    </Button>
                  </Link>
                  <Button variant='outline' size='lg' className='shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto' onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })}>
                    Explore Schools
                    <ChevronRight className='ml-2 h-5 w-5' />
                  </Button>
                </div>
                <div className='flex items-center gap-8 justify-center lg:justify-start pt-4'>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-primary'>12+</div>
                    <div className='text-sm text-muted-foreground'>Schools</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-primary'>500+</div>
                    <div className='text-sm text-muted-foreground'>Students</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-primary'>50+</div>
                    <div className='text-sm text-muted-foreground'>Teachers</div>
                  </div>
                </div>
              </div>
              <div className='flex items-center justify-center lg:justify-end'>
                <div className='relative w-full max-w-lg'>
                  <div className='absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/40 rounded-3xl blur-3xl'></div>
                  <div className='relative bg-background/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border'>
                    <div className='grid grid-cols-2 gap-4 mb-6'>
                      <div className='bg-primary/10 rounded-2xl p-4 text-center'>
                        <MonitorPlay className='h-8 w-8 text-primary mx-auto mb-2' />
                        <div className='text-sm font-medium'>Live Classes</div>
                      </div>
                      <div className='bg-primary/10 rounded-2xl p-4 text-center'>
                        <Users className='h-8 w-8 text-primary mx-auto mb-2' />
                        <div className='text-sm font-medium'>Interactive</div>
                      </div>
                      <div className='bg-primary/10 rounded-2xl p-4 text-center'>
                        <Globe className='h-8 w-8 text-primary mx-auto mb-2' />
                        <div className='text-sm font-medium'>Remote Access</div>
                      </div>
                      <div className='bg-primary/10 rounded-2xl p-4 text-center'>
                        <Award className='h-8 w-8 text-primary mx-auto mb-2' />
                        <div className='text-sm font-medium'>Quality Education</div>
                      </div>
                    </div>
                    <div className='text-center'>
                      <div className='w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse'>
                        <GraduationCap className='h-8 w-8 text-white' />
                      </div>
                      <div className='text-sm text-muted-foreground'>Powered by Learn Srinagar</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section id='stats' className='w-full py-16 bg-muted/30'>
          <div className='container mx-auto px-4 md:px-6'>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-8'>
              <div className='text-center group hover:scale-105 transition-transform duration-300'>
                <div className='w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors'>
                  <School className='h-8 w-8 text-primary' />
                </div>
                <div className='text-3xl font-bold text-primary mb-2'>12</div>
                <div className='text-sm text-muted-foreground'>Partner Schools</div>
              </div>
              <div className='text-center group hover:scale-105 transition-transform duration-300'>
                <div className='w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors'>
                  <Users className='h-8 w-8 text-primary' />
                </div>
                <div className='text-3xl font-bold text-primary mb-2'>500+</div>
                <div className='text-sm text-muted-foreground'>Active Students</div>
              </div>
              <div className='text-center group hover:scale-105 transition-transform duration-300'>
                <div className='w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors'>
                  <MonitorPlay className='h-8 w-8 text-primary' />
                </div>
                <div className='text-3xl font-bold text-primary mb-2'>1000+</div>
                <div className='text-sm text-muted-foreground'>Live Sessions</div>
              </div>
              <div className='text-center group hover:scale-105 transition-transform duration-300'>
                <div className='w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors'>
                  <Award className='h-8 w-8 text-primary' />
                </div>
                <div className='text-3xl font-bold text-primary mb-2'>95%</div>
                <div className='text-sm text-muted-foreground'>Success Rate</div>
              </div>
            </div>
          </div>
        </section>

        {/* Impact Section */}
        <section id='impact' className='w-full py-20 bg-gradient-to-br from-primary/5 via-background to-primary/10 relative overflow-hidden'>
          <div className='absolute inset-0 bg-grid-pattern opacity-5'></div>
          <div className='container mx-auto px-4 md:px-6 relative'>
            <div className='text-center mb-16'>
              <div className='inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-4'>
                <Award className='mr-2 h-4 w-4' />
                Our Impact
              </div>
              <h2 className='text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl mb-6'>
                Transforming Lives Through
                <span className='block text-primary'>Quality Education</span>
              </h2>
              <p className='max-w-3xl mx-auto text-lg text-muted-foreground md:text-xl'>
                See how Learn Srinagar is making a real difference in the educational landscape of Kashmir
              </p>
            </div>
            
            <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-16'>
              <Card className='group hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 border-0 shadow-lg bg-gradient-to-br from-background to-muted/20'>
                <CardHeader className='text-center pb-4'>
                  <div className='w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg'>
                    <Users className='h-10 w-10 text-white' />
                  </div>
                  <CardTitle className='text-2xl text-primary'>Student Success</CardTitle>
                </CardHeader>
                <CardContent className='text-center space-y-4'>
                  <div className='text-4xl font-bold text-primary'>95%</div>
                  <p className='text-muted-foreground'>
                    Student satisfaction rate with improved learning outcomes and engagement in remote classes
                  </p>
                  <div className='flex justify-center gap-4 text-sm'>
                    <div className='text-center'>
                      <div className='font-semibold text-primary'>500+</div>
                      <div className='text-muted-foreground'>Active Students</div>
                    </div>
                    <div className='text-center'>
                      <div className='font-semibold text-primary'>85%</div>
                      <div className='text-muted-foreground'>Attendance Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className='group hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 border-0 shadow-lg bg-gradient-to-br from-background to-muted/20'>
                <CardHeader className='text-center pb-4'>
                  <div className='w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg'>
                    <GraduationCap className='h-10 w-10 text-white' />
                  </div>
                  <CardTitle className='text-2xl text-primary'>Teacher Excellence</CardTitle>
                </CardHeader>
                <CardContent className='text-center space-y-4'>
                  <div className='text-4xl font-bold text-primary'>50+</div>
                  <p className='text-muted-foreground'>
                    Expert teachers delivering high-quality education across multiple schools simultaneously
                  </p>
                  <div className='flex justify-center gap-4 text-sm'>
                    <div className='text-center'>
                      <div className='font-semibold text-primary'>100%</div>
                      <div className='text-muted-foreground'>Qualified</div>
                    </div>
                    <div className='text-center'>
                      <div className='font-semibold text-primary'>6</div>
                      <div className='text-muted-foreground'>Subjects</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className='group hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 border-0 shadow-lg bg-gradient-to-br from-background to-muted/20 md:col-span-2 lg:col-span-1'>
                <CardHeader className='text-center pb-4'>
                  <div className='w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg'>
                    <MonitorPlay className='h-10 w-10 text-white' />
                  </div>
                  <CardTitle className='text-2xl text-primary'>Technology Impact</CardTitle>
                </CardHeader>
                <CardContent className='text-center space-y-4'>
                  <div className='text-4xl font-bold text-primary'>1000+</div>
                  <p className='text-muted-foreground'>
                    Interactive live sessions conducted with seamless connectivity and engagement
                  </p>
                  <div className='flex justify-center gap-4 text-sm'>
                    <div className='text-center'>
                      <div className='font-semibold text-primary'>99.9%</div>
                      <div className='text-muted-foreground'>Uptime</div>
                    </div>
                    <div className='text-center'>
                      <div className='font-semibold text-primary'>HD</div>
                      <div className='text-muted-foreground'>Quality</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className='bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-3xl p-8 md:p-12 text-center'>
              <div className='max-w-4xl mx-auto'>
                <h3 className='text-2xl md:text-3xl font-bold mb-6'>
                  "Learn Srinagar has revolutionized how we deliver education across Kashmir"
                </h3>
                <p className='text-lg text-muted-foreground mb-8'>
                  Our hybrid learning model has successfully bridged the educational gap, 
                  ensuring every student receives quality education regardless of their location.
                </p>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
                  <div className='text-center'>
                    <div className='text-3xl font-bold text-primary mb-2'>12</div>
                    <div className='text-sm text-muted-foreground'>Connected Schools</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-3xl font-bold text-primary mb-2'>3</div>
                    <div className='text-sm text-muted-foreground'>Grade Levels (6-8)</div>
                  </div>
                  <div className='text-center'>
                    <div className='text-3xl font-bold text-primary mb-2'>100%</div>
                    <div className='text-sm text-muted-foreground'>Digital Coverage</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id='features' className='w-full py-20'>
          <div className='container mx-auto px-4 md:px-6'>
            <div className='flex flex-col items-center justify-center space-y-4 text-center mb-16'>
              <div className='space-y-4'>
                <div className='inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary'>
                  <Zap className='mr-2 h-4 w-4' />
                  Innovative Features
                </div>
                <h2 className='text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl'>
                  Revolutionary Learning
                  <span className='block text-primary'>Environment</span>
                </h2>
                <p className='max-w-3xl text-lg text-muted-foreground md:text-xl'>
                  Learn Srinagar combines cutting-edge technology with proven educational methods 
                  to deliver exceptional learning experiences across Kashmir.
                </p>
              </div>
            </div>
            <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-3'>
              <Card className='group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg'>
                <CardHeader className='text-center pb-4'>
                  <div className='w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300'>
                    <MonitorPlay className='h-8 w-8 text-white' />
                  </div>
                  <CardTitle className='text-xl'>Central Studio</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-muted-foreground text-center'>
                    State-of-the-art broadcasting studio with 4K cameras, professional audio, 
                    and interactive whiteboards for immersive learning experiences.
                  </p>
                </CardContent>
              </Card>
              
              <Card className='group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg'>
                <CardHeader className='text-center pb-4'>
                  <div className='w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300'>
                    <Users className='h-8 w-8 text-white' />
                  </div>
                  <CardTitle className='text-xl'>Interactive Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-muted-foreground text-center'>
                    Real-time two-way communication enabling students to participate actively, 
                    ask questions, and collaborate with peers across different schools.
                  </p>
                </CardContent>
              </Card>
              
              <Card className='group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg'>
                <CardHeader className='text-center pb-4'>
                  <div className='w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300'>
                    <BookOpen className='h-8 w-8 text-white' />
                  </div>
                  <CardTitle className='text-xl'>Digital Resources</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-muted-foreground text-center'>
                    Comprehensive digital library with interactive content, multimedia resources, 
                    and personalized learning materials tailored to each student's needs.
                  </p>
                </CardContent>
              </Card>
              
              <Card className='group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg'>
                <CardHeader className='text-center pb-4'>
                  <div className='w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300'>
                    <GraduationCap className='h-8 w-8 text-white' />
                  </div>
                  <CardTitle className='text-xl'>Expert Educators</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-muted-foreground text-center'>
                    Highly qualified teachers with specialized expertise delivering lessons 
                    to multiple schools, ensuring consistent quality education for all.
                  </p>
                </CardContent>
              </Card>
              
              <Card className='group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg'>
                <CardHeader className='text-center pb-4'>
                  <div className='w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300'>
                    <Shield className='h-8 w-8 text-white' />
                  </div>
                  <CardTitle className='text-xl'>Secure Platform</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-muted-foreground text-center'>
                    Enterprise-grade security with encrypted communications, secure login systems, 
                    and comprehensive data protection for student privacy.
                  </p>
                </CardContent>
              </Card>
              
              <Card className='group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg'>
                <CardHeader className='text-center pb-4'>
                  <div className='w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300'>
                    <Building2 className='h-8 w-8 text-white' />
                  </div>
                  <CardTitle className='text-xl'>Infrastructure Support</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-muted-foreground text-center'>
                    Complete technical setup and ongoing support for all participating schools, 
                    ensuring seamless connectivity and optimal learning conditions.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section id='mission' className='w-full py-20 bg-gradient-to-br from-muted/30 to-muted/10'>
          <div className='container mx-auto px-4 md:px-6'>
            <div className='grid gap-12 lg:grid-cols-2 items-center'>
              <div className='space-y-6'>
                <div className='space-y-4'>
                  <div className='inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary'>
                    <Globe className='mr-2 h-4 w-4' />
                    Our Mission
                  </div>
                  <h2 className='text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl'>
                    Bridging Educational
                    <span className='block text-primary'>Gaps in Kashmir</span>
                  </h2>
                  <p className='text-lg text-muted-foreground md:text-xl leading-relaxed'>
                    Learn Srinagar is committed to democratizing quality education across Kashmir. 
                    We believe every student deserves access to excellent teachers and resources, 
                    regardless of their school's location or infrastructure limitations.
                  </p>
                </div>
              </div>
              <div className='space-y-6'>
                <div className='inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary'>
                  <Award className='mr-2 h-4 w-4' />
                  Our Impact Goals
                </div>
                <div className='grid gap-6'>
                  <div className='flex items-start gap-4 group'>
                    <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300'>
                      <Users className='h-6 w-6' />
                    </div>
                    <div className='space-y-1'>
                      <h3 className='text-lg font-semibold'>Equitable Access</h3>
                      <p className='text-muted-foreground'>
                        Ensuring every student in Kashmir has access to the same quality of education, 
                        breaking down geographical and resource barriers.
                      </p>
                    </div>
                  </div>
                  
                  <div className='flex items-start gap-4 group'>
                    <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300'>
                      <LayoutGrid className='h-6 w-6' />
                    </div>
                    <div className='space-y-1'>
                      <h3 className='text-lg font-semibold'>Resource Optimization</h3>
                      <p className='text-muted-foreground'>
                        Maximizing educational impact by sharing expert teachers and premium 
                        resources across our entire network of schools.
                      </p>
                    </div>
                  </div>
                  
                  <div className='flex items-start gap-4 group'>
                    <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300'>
                      <GraduationCap className='h-6 w-6' />
                    </div>
                    <div className='space-y-1'>
                      <h3 className='text-lg font-semibold'>Teacher Excellence</h3>
                      <p className='text-muted-foreground'>
                        Empowering educators with professional development opportunities and 
                        platforms to share their expertise with a broader audience.
                      </p>
                    </div>
                  </div>
                  
                  <div className='flex items-start gap-4 group'>
                    <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300'>
                      <Building2 className='h-6 w-6' />
                    </div>
                    <div className='space-y-1'>
                      <h3 className='text-lg font-semibold'>Community Building</h3>
                      <p className='text-muted-foreground'>
                        Creating a unified educational ecosystem that connects schools, 
                        students, and families across Kashmir's diverse communities.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Schools Section */}
        <section id='schools' className='w-full py-20'>
          <div className='container mx-auto px-4 md:px-6'>
            <div className='flex flex-col items-center justify-center space-y-4 text-center mb-16'>
              <div className='space-y-4'>
                <div className='inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary'>
                  <School className='mr-2 h-4 w-4' />
                  Partner Schools
                </div>
                <h2 className='text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl'>
                  Our Growing Network
                  <span className='block text-primary'>Across Srinagar</span>
                </h2>
                <p className='max-w-3xl text-lg text-muted-foreground md:text-xl'>
                  These prestigious institutions are part of the Learn Srinagar ecosystem, 
                  working together to provide world-class education to students across Kashmir.
                </p>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {schools.map((school, index) => (
                <Card key={index} className='group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 shadow-lg overflow-hidden'>
                  <div className='h-2 bg-gradient-to-r from-primary to-primary/80'></div>
                  <CardHeader className='pb-4'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <CardTitle className='text-lg leading-tight mb-2 group-hover:text-primary transition-colors'>
                          {school.name}
                        </CardTitle>
                        <CardDescription className='text-sm font-medium text-primary/80'>
                          Zone: {school.zone}
                        </CardDescription>
                      </div>
                      <div className='w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors'>
                        <School className='h-5 w-5 text-primary' />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className='pt-0'>
                    <div className='space-y-3'>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 bg-muted rounded-lg flex items-center justify-center'>
                          <MapPin className='h-4 w-4 text-muted-foreground' />
                        </div>
                        <div>
                          <div className='text-sm font-medium'>Constituency</div>
                          <div className='text-sm text-muted-foreground'>{school.constituency}</div>
                        </div>
                      </div>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 bg-muted rounded-lg flex items-center justify-center'>
                          <Building2 className='h-4 w-4 text-muted-foreground' />
                        </div>
                        <div>
                          <div className='text-sm font-medium'>School Code</div>
                          <div className='text-xs text-muted-foreground font-mono'>{school.code}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className='pt-4 border-t bg-muted/20'>
                    <div className='flex items-center justify-between w-full'>
                      <div className='flex items-center gap-2'>
                        <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse'></div>
                        <span className='text-xs text-muted-foreground'>Active Network</span>
                      </div>
                      <Button variant='ghost' size='sm' className='text-xs hover:bg-primary/10'>
                        View Details
                        <ChevronRight className='ml-1 h-3 w-3' />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
            
            <div className='text-center mt-12'>
              <div className='inline-flex items-center gap-2 text-sm text-muted-foreground'>
                <div className='w-2 h-2 bg-primary rounded-full animate-pulse'></div>
                More schools joining our network every month
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className='w-full border-t bg-muted/30 py-12'>
        <div className='container mx-auto px-4 md:px-6'>
          <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-4'>
            <div className='space-y-4'>
              <div className='flex items-center gap-3'>
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground'>
                  <GraduationCap className='h-5 w-5' />
                </div>
                <div>
                  <div className='font-bold text-lg'>Learn Srinagar</div>
                  <div className='text-xs text-muted-foreground'>Transforming Education</div>
                </div>
              </div>
              <p className='text-sm text-muted-foreground max-w-xs'>
                Transforming education across Kashmir through innovative hybrid learning solutions.
              </p>
            </div>
            
            <div className='space-y-4'>
              <h4 className='font-semibold'>Quick Links</h4>
              <div className='space-y-2 text-sm'>
                <Link to='#features' className='block text-muted-foreground hover:text-primary transition-colors'>
                  Features
                </Link>
                <Link to='#mission' className='block text-muted-foreground hover:text-primary transition-colors'>
                  Our Mission
                </Link>
                <Link to='/blogs' className='block text-muted-foreground hover:text-primary transition-colors'>
                  Blog
                </Link>
                <Link to='#schools' className='block text-muted-foreground hover:text-primary transition-colors'>
                  Partner Schools
                </Link>
                <Link to='/login' className='block text-muted-foreground hover:text-primary transition-colors'>
                  Login Portal
                </Link>
              </div>
            </div>
            
            <div className='space-y-4'>
              <h4 className='font-semibold'>Education</h4>
              <div className='space-y-2 text-sm'>
                <div className='text-muted-foreground'>Classes 6-8</div>
                <div className='text-muted-foreground'>Live Interactive Sessions</div>
                <div className='text-muted-foreground'>Digital Resources</div>
                <div className='text-muted-foreground'>Expert Teachers</div>
              </div>
            </div>
            
            <div className='space-y-4'>
              <h4 className='font-semibold'>Contact Info</h4>
              <div className='space-y-2 text-sm text-muted-foreground'>
                <div>Srinagar, Kashmir</div>
                <div>Education Department</div>
                <div>learnsrinagar.in</div>
              </div>
            </div>
          </div>
          
          <div className='border-t mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4'>
            <div className='flex items-center gap-2'>
              <p className='text-sm text-muted-foreground'>
                © {new Date().getFullYear()} Learn Srinagar. All rights reserved.
              </p>
            </div>
            <div className='flex items-center gap-4 text-sm text-muted-foreground'>
              <span>Empowering Kashmir's Future</span>
              <div className='w-2 h-2 bg-primary rounded-full animate-pulse'></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
