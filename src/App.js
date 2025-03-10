import { useState, useEffect } from 'react';
import {
  Tabs,
  Tab,
  Box,
  Paper,
  ThemeProvider,
  createTheme,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  FormHelperText,
  Button,
  Stack
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TableChartIcon from '@mui/icons-material/TableChart';
import SendIcon from '@mui/icons-material/Send';
import DownloadIcon from '@mui/icons-material/Download';
import * as XLSX from 'xlsx';
import './App.css';
import {
  ref,
  push,
  onValue,
  query,
  orderByChild,
  equalTo
} from 'firebase/database';
import { db } from './firebase';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';

function App() {
  const [formData, setFormData] = useState([]);
  const [currentResponse, setCurrentResponse] = useState({
    // Part I: Personal Information
    companyType: '',
    gender: '',
    age: '',
    workDuration: '',
    // Part II: Survey Questions (initialized with empty values)
    ...Object.fromEntries([...Array(25)].map((_, i) => [`q${i + 1}`, '']))
  });
  const [activeTab, setActiveTab] = useState(0);
  const [errors, setErrors] = useState({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [authError, setAuthError] = useState('');

  const theme = createTheme({
    palette: {
      primary: {
        main: '#4285f4'
      }
    }
  });

  const auth = getAuth();
  const googleProvider = new GoogleAuthProvider();

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentResponse((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  // Load responses from Firebase when component mounts
  useEffect(() => {
    const responsesRef = ref(db, 'responses');
    onValue(responsesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert Firebase object to array and parse dates
        const responsesArray = Object.values(data).map((response) => ({
          ...response,
          timestamp: new Date(response.timestamp)
        }));
        setFormData(responsesArray);
      }
    });
  }, []);

  // Check if user has already submitted
  useEffect(() => {
    if (isLoggedIn && auth.currentUser) {
      const responsesRef = ref(db, 'responses');
      const userResponsesQuery = query(
        responsesRef,
        orderByChild('userEmail'),
        equalTo(auth.currentUser.email)
      );

      onValue(userResponsesQuery, (snapshot) => {
        setHasSubmitted(snapshot.exists());
      });
    }
  }, [isLoggedIn, auth.currentUser]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setIsLoggedIn(true);
      setAuthError('');
    } catch (error) {
      setAuthError('Login error: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Update handleSubmit to include user email
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!isLoggedIn) {
      setErrors({ auth: 'Please log in to submit the survey' });
      return;
    }

    if (hasSubmitted) {
      setErrors({ auth: 'You have already submitted the survey' });
      return;
    }

    const newErrors = {};

    // Validate all personal information fields
    const personalInfoFields = {
      companyType: 'Please select a company type',
      gender: 'Please select your gender',
      age: 'Please select your age range',
      workDuration: 'Please select your work duration'
    };

    Object.entries(personalInfoFields).forEach(([field, message]) => {
      if (!currentResponse[field]) {
        newErrors[field] = message;
      }
    });

    // Validate all Likert scale questions
    for (let i = 1; i <= 25; i++) {
      if (!currentResponse[`q${i}`]) {
        newErrors[`q${i}`] = 'Please select an answer';
      }
    }

    // If there are errors, show them and prevent submission
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // If no errors, save to Firebase
    const responsesRef = ref(db, 'responses');

    const dataToSubmit = {
      ...currentResponse,
      timestamp: new Date().toISOString(),
      userEmail: auth.currentUser.email
    };

    try {
      push(responsesRef, dataToSubmit)
        .then(() => {
          console.log('Successfully saved to Firebase'); // Debug log
          // Clear form
          setErrors({});
          setCurrentResponse({
            companyType: '',
            gender: '',
            age: '',
            workDuration: '',
            ...Object.fromEntries(
              [...Array(25)].map((_, i) => [`q${i + 1}`, ''])
            )
          });
          setHasSubmitted(true);
        })
        .catch((error) => {
          console.error('Firebase push error:', error); // More specific error log
        });
    } catch (error) {
      console.error('Try-catch error:', error); // Catch any synchronous errors
    }
  };

  // Update the sorting to ascending order (oldest first)
  const sortedFormData = [...formData].sort((a, b) => {
    // Sort in ascending order (oldest first)
    return new Date(a.timestamp) - new Date(b.timestamp);
  });

  const handleExport = () => {
    if (formData.length === 0) return;

    const exportData = sortedFormData.map((response) => ({
      Timestamp: formatDate(response.timestamp),
      'Company Type': response.companyType,
      Gender: response.gender,
      Age: response.age,
      'Work Duration': response.workDuration,
      // Add all 25 questions with their full text
      ...Object.fromEntries(
        [...Array(25)].map((_, i) => [
          getLikertQuestionText(i + 1),
          response[`q${i + 1}`]
        ])
      )
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Survey Responses');

    // Save file
    XLSX.writeFile(wb, 'survey_responses.xlsx');
  };

  return (
    <ThemeProvider theme={theme}>
      <div className='App'>
        <Paper elevation={3} className='tabs-container'>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant='fullWidth'
              indicatorColor='primary'
              textColor='primary'
              aria-label='survey tabs'
            >
              <Tab
                icon={<AssignmentIcon />}
                iconPosition='start'
                label='Survey Form'
                sx={{
                  fontWeight: 'bold',
                  textTransform: 'none',
                  fontSize: '1rem'
                }}
              />
              <Tab
                icon={<TableChartIcon />}
                iconPosition='start'
                label='Responses'
                sx={{
                  fontWeight: 'bold',
                  textTransform: 'none',
                  fontSize: '1rem'
                }}
              />
            </Tabs>
          </Box>
        </Paper>

        {activeTab === 0 ? (
          <div className='form-container'>
            {!isLoggedIn ? (
              <div
                className='login-container'
                style={{
                  padding: '32px',
                  maxWidth: '400px',
                  margin: '40px auto',
                  textAlign: 'center',
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
                }}
              >
                <h2
                  style={{
                    fontSize: '24px',
                    fontWeight: '500',
                    color: '#202124',
                    marginBottom: '24px',
                    lineHeight: '1.334'
                  }}
                >
                  Welcome to the Leadership Research Survey
                </h2>
                <p
                  style={{
                    color: '#5f6368',
                    fontSize: '14px',
                    marginBottom: '24px',
                    lineHeight: '1.5'
                  }}
                >
                  Please sign in with your Google account to participate in the
                  survey
                </p>
                <Button
                  onClick={handleGoogleLogin}
                  variant='contained'
                  fullWidth
                  sx={{
                    mt: 2,
                    backgroundColor: '#fff',
                    color: '#3c4043',
                    '&:hover': {
                      backgroundColor: '#f8f9fa',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                    },
                    textTransform: 'none',
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '12px 24px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    border: '1px solid #dadce0',
                    borderRadius: '4px',
                    fontSize: '16px',
                    fontWeight: '500'
                  }}
                >
                  <img
                    src='https://www.google.com/favicon.ico'
                    alt='Google'
                    style={{ width: '18px', height: '18px' }}
                  />
                  Sign in with Google
                </Button>
                {authError && (
                  <FormHelperText
                    error
                    style={{
                      marginTop: '16px',
                      fontSize: '14px'
                    }}
                  >
                    {authError}
                  </FormHelperText>
                )}
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 20px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <img
                      src={
                        auth.currentUser.photoURL ||
                        'https://www.google.com/favicon.ico'
                      }
                      alt='Profile'
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%'
                      }}
                    />
                    <span
                      style={{
                        color: '#5f6368',
                        fontSize: '0.9rem'
                      }}
                    >
                      {auth.currentUser.email}
                    </span>
                  </div>
                  <Button
                    onClick={handleLogout}
                    variant='outlined'
                    size='small'
                    sx={{
                      textTransform: 'none',
                      borderColor: '#dadce0',
                      color: '#5f6368',
                      '&:hover': {
                        borderColor: '#5f6368',
                        backgroundColor: 'rgba(95, 99, 104, 0.04)'
                      }
                    }}
                  >
                    Sign out
                  </Button>
                </div>
                {hasSubmitted ? (
                  <div className='already-submitted'>
                    <h2>Thank you for your submission!</h2>
                    <p>You have already completed this survey.</p>
                  </div>
                ) : (
                  <div className='survey-intro'>
                    <h1>Research Survey</h1>
                    <p>
                      This survey was conducted with the aim of studying the
                      role of transformational leadership style in improving job
                      contentment of office workers in Da Nang. Through this
                      research, I hope to clarify the relationship between
                      leadership style and employees' job contentment, thereby
                      providing useful recommendations to improve management
                      effectiveness and enhance work motivation in
                      organizations.
                    </p>
                    <p>
                      In this survey, you will be asked to answer questions
                      related to the leadership style you have experienced as
                      well as your perception of current job contentment. Your
                      answers will play an important role in completing my MBA's
                      thesis at the University of Central Lancashire, UK.
                    </p>
                    <p>
                      I promise that all information provided will be kept
                      strictly confidential. The survey data will be used for
                      research purposes only and only I will have access to it.
                      If you have any questions regarding privacy or research,
                      please contact via email: DTHVo@uclan.ac.uk
                    </p>
                    <p>
                      Thank you for taking the time to participate in this
                      survey!
                    </p>
                    <p>Best regards,</p>
                    <p>Vo Duy Tan Hoang.</p>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className='section'>
                    <h2>Part I: Personal Information</h2>

                    <FormControl
                      component='fieldset'
                      className='question'
                      error={!!errors.companyType}
                    >
                      <FormLabel component='legend'>
                        1. Which type of company you are working for in Da Nang
                        city? *
                      </FormLabel>
                      <RadioGroup
                        name='companyType'
                        value={currentResponse.companyType}
                        onChange={handleInputChange}
                      >
                        {[
                          'State-owned company',
                          'Private company',
                          'Foreign company'
                        ].map((option) => (
                          <FormControlLabel
                            key={option}
                            value={option}
                            control={<Radio />}
                            label={option}
                          />
                        ))}
                      </RadioGroup>
                      {errors.companyType && (
                        <FormHelperText error>
                          {errors.companyType}
                        </FormHelperText>
                      )}
                    </FormControl>

                    <FormControl
                      component='fieldset'
                      className='question'
                      error={!!errors.gender}
                    >
                      <FormLabel component='legend'>
                        2. What is your gender? *
                      </FormLabel>
                      <RadioGroup
                        name='gender'
                        value={currentResponse.gender}
                        onChange={handleInputChange}
                      >
                        {['Male', 'Female', 'Other'].map((option) => (
                          <FormControlLabel
                            key={option}
                            value={option}
                            control={<Radio />}
                            label={option}
                          />
                        ))}
                      </RadioGroup>
                      {errors.gender && (
                        <FormHelperText error>{errors.gender}</FormHelperText>
                      )}
                    </FormControl>

                    <FormControl
                      component='fieldset'
                      className='question'
                      error={!!errors.age}
                    >
                      <FormLabel component='legend'>
                        3. How old are you? *
                      </FormLabel>
                      <RadioGroup
                        name='age'
                        value={currentResponse.age}
                        onChange={handleInputChange}
                      >
                        {[
                          'Under 20 years old',
                          'From 20 to 35 years old',
                          'From 36 to 50 years old',
                          'Over 50 years old'
                        ].map((option) => (
                          <FormControlLabel
                            key={option}
                            value={option}
                            control={<Radio />}
                            label={option}
                          />
                        ))}
                      </RadioGroup>
                      {errors.age && (
                        <FormHelperText error>{errors.age}</FormHelperText>
                      )}
                    </FormControl>

                    <FormControl
                      component='fieldset'
                      className='question'
                      error={!!errors.workDuration}
                    >
                      <FormLabel component='legend'>
                        4. How long have you been working in your company? *
                      </FormLabel>
                      <RadioGroup
                        name='workDuration'
                        value={currentResponse.workDuration}
                        onChange={handleInputChange}
                      >
                        {[
                          'Under 1 year',
                          'From 1 year to 3 years',
                          'From 3 years to 5 years',
                          'Over 5 years'
                        ].map((option) => (
                          <FormControlLabel
                            key={option}
                            value={option}
                            control={<Radio />}
                            label={option}
                          />
                        ))}
                      </RadioGroup>
                      {errors.workDuration && (
                        <FormHelperText error>
                          {errors.workDuration}
                        </FormHelperText>
                      )}
                    </FormControl>
                  </div>

                  <div className='section'>
                    <h2>
                      Part II: Survey on the role of transformational leadership
                      style in improving job contentment
                    </h2>
                    <FormHelperText className='scale-description'>
                      Please indicate your level of assessment: (1) Strongly
                      Disagree, (2) Disagree, (3) Neutral, (4) Agree, (5)
                      Strongly Agree
                    </FormHelperText>

                    {[...Array(25)].map((_, index) => (
                      <FormControl
                        key={index}
                        component='fieldset'
                        className='likert-question'
                        error={!!errors[`q${index + 1}`]}
                      >
                        <FormLabel component='legend'>
                          {index + 1}. {getLikertQuestionText(index + 1)}
                        </FormLabel>
                        <RadioGroup
                          row
                          name={`q${index + 1}`}
                          value={currentResponse[`q${index + 1}`]}
                          onChange={handleInputChange}
                          className='likert-scale'
                        >
                          {[1, 2, 3, 4, 5].map((value) => (
                            <FormControlLabel
                              key={value}
                              value={value.toString()}
                              control={<Radio />}
                              label={value.toString()}
                              labelPlacement='bottom'
                            />
                          ))}
                        </RadioGroup>
                        {errors[`q${index + 1}`] && (
                          <FormHelperText error>
                            {errors[`q${index + 1}`]}
                          </FormHelperText>
                        )}
                      </FormControl>
                    ))}
                  </div>

                  <Stack
                    direction='row'
                    justifyContent='flex-start'
                    sx={{ mt: 4 }}
                  >
                    <Button
                      type='submit'
                      variant='contained'
                      size='large'
                      endIcon={<SendIcon />}
                      sx={{
                        backgroundColor: '#4285f4',
                        '&:hover': {
                          backgroundColor: '#357abd'
                        },
                        padding: '12px 32px',
                        fontSize: '1rem',
                        textTransform: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      Submit Survey
                    </Button>
                  </Stack>
                </form>
              </>
            )}
          </div>
        ) : (
          <div className='responses-container'>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                flexWrap: 'wrap'
              }}
            >
              <h2>Survey Responses</h2>
              <Button
                variant='outlined'
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                disabled={formData.length === 0}
                sx={{
                  borderColor: '#4285f4',
                  color: '#4285f4',
                  '&:hover': {
                    borderColor: '#357abd',
                    backgroundColor: 'rgba(66, 133, 244, 0.04)'
                  }
                }}
              >
                Export to Excel
              </Button>
            </div>
            <div className='table-wrapper'>
              <table className='responses-table'>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Company Type</th>
                    <th>Gender</th>
                    <th>Age</th>
                    <th>Work Duration</th>
                    {[...Array(25)].map((_, i) => (
                      <th key={i} title={getLikertQuestionText(i + 1)}>
                        {getLikertQuestionText(i + 1)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedFormData.map((response, index) => (
                    <tr key={index}>
                      <td>{formatDate(response.timestamp)}</td>
                      <td>{response.companyType}</td>
                      <td>{response.gender}</td>
                      <td>{response.age}</td>
                      <td>{response.workDuration}</td>
                      {[...Array(25)].map((_, i) => (
                        <td key={i}>{response[`q${i + 1}`]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

// Helper function to get the question text
function getLikertQuestionText(questionNumber) {
  const questions = {
    1: 'Your leader allocates time guiding and mentoring you.',
    2: 'Your leader regards you as a unique person, not merely a subordinate.',
    3: 'Your leader recognizes and accommodates your varied needs, abilities, and aspirations.',
    4: 'Your leader supports you in developing your strengths.',
    5: 'Your leader expresses optimism about the future.',
    6: 'Your leader talks enthusiastically about what needs to be achieved.',
    7: 'Your leader conveys a persuasive and inspiring vision of the future.',
    8: 'Your leader displays confidence that goals will be achieved.',
    9: 'Your leader re-examines critical assumptions to validate their appropriateness.',
    10: 'Your leader seeks different viewpoints when addressing challenges.',
    11: 'Your leader encourages you to analyze problems from diverse perspectives.',
    12: 'Your leader introduces new approaches in completing assignments.',
    13: 'Your leader talks about his/her core beliefs and values that are personally significant.',
    14: 'Your leader identifies the necessity of having a strong sense of purpose and mission.',
    15: 'Your leader considers the ethical and moral consequences of decisions.',
    16: 'Your leader values the importance of having a collective sense of mission.',
    17: 'Your leader instills pride and a sense of respect for being associated with him/her.',
    18: 'Your leader prioritizes the sake of the organization above personal interests.',
    19: 'Your leader acts in ways that build your admiration, respect, and trust.',
    20: 'Your leader portrays a sense of power and confidence.',
    21: 'You are contented with your current job.',
    22: 'You are enthusiastic and dedicated to your job.',
    23: 'You feel that your working hours pass quickly.',
    24: 'You find your current job to be a good fit for you.',
    25: 'You find your job interesting.'
  };
  return questions[questionNumber] || '';
}

export default App;
