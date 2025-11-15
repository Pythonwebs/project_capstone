import {
  Stack,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  InputAdornment,
  IconButton,
} from "@mui/material";
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import { useContext, useEffect, useState } from "react";
import { useTheme } from '@mui/material/styles';
import { AuthContext } from "./AuthProvider";
import axios from "axios";

export default function Home() {
  const { isLogged } = useContext(AuthContext);
  const [incidents, setIncidents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('number');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createIncident, setCreateIncident] = useState({
    short_description: '',
    impact: '',
    urgency: ''
  });
  const [successMessage, setSuccessMessage] = useState('');

  const handleDelete = async (sys_id) => {
    if (window.confirm('Are you sure you want to delete this incident?')) {
      try {
        const response = await axios.delete(`http://localhost:3001/api/incidents/${sys_id}`, {
          withCredentials: true
        });
        
        if (response.data.success) {
          // Refresh the incidents list after deletion
          fetchData();
        } else {
          throw new Error('Delete operation did not return success');
        }
      } catch (error) {
        console.error('Error deleting incident:', error);
        alert(error.response?.data?.error || 'Failed to delete incident. Please try again.');
      }
    }
  };

  const handleCreateOpen = () => setCreateDialogOpen(true);
  const handleCreateClose = () => {
    setCreateDialogOpen(false);
    setCreateIncident({ short_description: '', impact: '', urgency: '' });
  };

  const handleCreateInput = (e) => {
    const { name, value } = e.target;
    setCreateIncident(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async () => {
    if (!createIncident.short_description || !createIncident.impact || !createIncident.urgency) {
      alert('Please fill short description, impact and urgency');
      return;
    }

    try {
      const payload = {
        short_description: createIncident.short_description,
        impact: Number(createIncident.impact),
        urgency: Number(createIncident.urgency)
      };

      const response = await axios.post('http://localhost:3001/api/incidents', payload, { withCredentials: true });

      if (response.data && response.data.result) {
        handleCreateClose();
        setSuccessMessage('Incident created successfully');
        // small delay to allow instance to process
        setTimeout(fetchData, 800);
      } else if (response.data && response.data.error) {
        // server returned a structured error
        console.error('Create response error:', response.data);
        alert(`Create failed: ${JSON.stringify(response.data.error)}`);
      } else {
        alert('Failed to create incident: unexpected response');
        console.error('Create response:', response.data);
      }
    } catch (err) {
      console.error('Create error:', err.response?.data || err.message || err);
      const serverErr = err.response?.data?.error || err.response?.data || err.message;
      alert(`Failed to create incident: ${JSON.stringify(serverErr)}`);
    }
  };

  const handleEditClick = (incident) => {
    setSelectedIncident({
      sys_id: incident.sys_id,
      short_description: incident.short_description,
      state: incident.state,
      priority: incident.priority,
      impact: incident.impact || '',
      urgency: incident.urgency || ''
    });
    setEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setSelectedIncident(null);
  };

  const handleEditSave = async () => {
    try {
      if (!selectedIncident.short_description) {
        alert('Description cannot be empty');
        return;
      }

      console.log('Saving incident:', selectedIncident);
      // compute priority from impact and urgency: priority = impact + urgency - 1 (cap at 5)
      const impactVal = selectedIncident.impact ? Number(selectedIncident.impact) : undefined;
      const urgencyVal = selectedIncident.urgency ? Number(selectedIncident.urgency) : undefined;
      let computedPriority;
      if (impactVal && urgencyVal) {
        computedPriority = Math.min(impactVal + urgencyVal - 1, 5);
      }

      const payload = {
        short_description: selectedIncident.short_description,
        impact: impactVal,
        urgency: urgencyVal,
        state: selectedIncident.state,
        ...(computedPriority !== undefined ? { priority: computedPriority } : {}),
      };

      const response = await axios.put(
        `http://localhost:3001/api/incidents/${selectedIncident.sys_id}`,
        payload,
        { 
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.result) {
        handleEditClose();
        fetchData();
      } else if (response.data && response.data.error) {
        throw new Error(JSON.stringify(response.data.error));
      } else {
        throw new Error('Update operation did not return result');
      }
    } catch (error) {
      console.error('Error updating incident:', error);
      alert(error.response?.data?.error || 'Failed to update incident. Please try again.');
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSelectedIncident(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const theme = useTheme();

  async function fetchData() {
    if (isLogged) {
      const incidentList = await axios.get(
        "http://localhost:3001/api/incidents",
        { withCredentials: true }
      );
      setIncidents(incidentList.data.result);
    }
  }

  useEffect(() => {
    fetchData();
  }, [isLogged]);

  return (
    <>
      {isLogged && incidents ? (
        <>
          <Stack spacing={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5" sx={{ letterSpacing: 0.5 }}>Incident Records</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="search-field-label">Search Field</InputLabel>
                  <Select
                    labelId="search-field-label"
                    value={searchField}
                    label="Search Field"
                    onChange={(e) => setSearchField(e.target.value)}
                  >
                    <MenuItem value="number">Incident Number</MenuItem>
                    <MenuItem value="state">State</MenuItem>
                    <MenuItem value="short_description">Short Description</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  placeholder={
                    searchField === 'number' ? 'Search by incident number' :
                    searchField === 'state' ? 'Search by state' :
                    'Search by description'
                  }
                  size="small"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setSearchTerm('')}
                          aria-label="clear-search"
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{ minWidth: 320, bgcolor: theme.palette.mode === 'light' ? 'white' : undefined }}
                />

                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={handleCreateOpen}
                  sx={{ borderRadius: 2, px: 3, py: 1.2, textTransform: 'none', fontWeight: 600 }}
                >
                  Create New Incident
                </Button>
              </Box>
            </Stack>

            <Dialog open={createDialogOpen} onClose={handleCreateClose} maxWidth="sm" fullWidth>
              <DialogTitle>Create New Incident</DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <TextField
                    name="short_description"
                    label="Short Description"
                    value={createIncident.short_description}
                    onChange={handleCreateInput}
                    multiline
                    rows={3}
                    fullWidth
                  />
                  <FormControl fullWidth>
                    <InputLabel>Impact</InputLabel>
                    <Select name="impact" value={createIncident.impact} onChange={handleCreateInput} label="Impact">
                      <MenuItem value="1">High (1)</MenuItem>
                      <MenuItem value="2">Medium (2)</MenuItem>
                      <MenuItem value="3">Low (3)</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Urgency</InputLabel>
                    <Select name="urgency" value={createIncident.urgency} onChange={handleCreateInput} label="Urgency">
                      <MenuItem value="1">High (1)</MenuItem>
                      <MenuItem value="2">Medium (2)</MenuItem>
                      <MenuItem value="3">Low (3)</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCreateClose}>Cancel</Button>
                <Button onClick={handleCreateSubmit} variant="contained" color="primary">Create</Button>
              </DialogActions>
            </Dialog>

            <Grid container spacing={5} justifyContent={"space-around"}>
              {incidents
                .filter(inc => {
                  if (!searchTerm) return true;
                  const q = searchTerm.toLowerCase();
                  const number = (inc.number || '').toLowerCase();
                  const state = (inc.state || '').toLowerCase();
                  const desc = (inc.short_description || '').toLowerCase();
                  if (searchField === 'number') return number.includes(q);
                  if (searchField === 'state') return state.includes(q);
                  if (searchField === 'short_description') return desc.includes(q);
                  return true;
                })
                .map((inc, index) => {
                  return (
                    <Grid key={inc.sys_id}>
                    <Card
                      sx={{
                        width: 320,
                        height: 220,
                        borderRadius: 2,
                        boxShadow: 3,
                        bgcolor: theme.palette.mode === 'light' ? '#f5f5f5' : undefined,
                        border: theme.palette.mode === 'light' ? '1px solid' : 'none',
                        borderColor: theme.palette.mode === 'light' ? '#e0e0e0' : 'transparent',
                      }}
                    >
                      <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                        <Box>
                          <Typography variant="h6" sx={{ mb: 1 }}>
                            Incident #: {inc.number}
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                            {inc.short_description}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                                color: theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.secondary,
                                px: 1,
                                borderRadius: 1,
                              }}
                            >
                              {inc.state}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                                color: theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.secondary,
                                px: 1,
                                borderRadius: 1,
                              }}
                            >
                              Priority: {inc.priority}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, alignItems: 'center' }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<EditIcon />}
                            color="primary"
                            onClick={() => handleEditClick(inc)}
                            sx={{ textTransform: 'none' }}
                          >
                            Edit
                          </Button>

                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<DeleteIcon />}
                            color="error"
                            onClick={() => handleDelete(inc.sys_id)}
                            sx={{ textTransform: 'none' }}
                          >
                            Delete
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onClose={handleEditClose}>
              <DialogTitle>Edit Incident</DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <TextField
                    name="short_description"
                    label="Description"
                    value={selectedIncident?.short_description || ''}
                    onChange={handleInputChange}
                    multiline
                    rows={4}
                    fullWidth
                  />
                  <FormControl fullWidth sx={{ mt: 1 }}>
                    <InputLabel>Impact</InputLabel>
                    <Select
                      name="impact"
                      value={selectedIncident?.impact || ''}
                      onChange={handleInputChange}
                      label="Impact"
                    >
                      <MenuItem value="1">High (1)</MenuItem>
                      <MenuItem value="2">Medium (2)</MenuItem>
                      <MenuItem value="3">Low (3)</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth sx={{ mt: 1 }}>
                    <InputLabel>Urgency</InputLabel>
                    <Select
                      name="urgency"
                      value={selectedIncident?.urgency || ''}
                      onChange={handleInputChange}
                      label="Urgency"
                    >
                      <MenuItem value="1">High (1)</MenuItem>
                      <MenuItem value="2">Medium (2)</MenuItem>
                      <MenuItem value="3">Low (3)</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>State</InputLabel>
                    <Select
                      name="state"
                      value={selectedIncident?.state || ''}
                      onChange={handleInputChange}
                      label="State"
                    >
                      <MenuItem value="New">New</MenuItem>
                      <MenuItem value="In Progress">In Progress</MenuItem>
                      <MenuItem value="On Hold">On Hold</MenuItem>
                      <MenuItem value="Resolved">Resolved</MenuItem>
                      <MenuItem value="Closed">Closed</MenuItem>
                    </Select>
                  </FormControl>
                  {/* Priority is computed from Impact and Urgency; removed editable priority field */}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleEditClose}>Cancel</Button>
                <Button onClick={handleEditSave} variant="contained" color="primary">
                  Save Changes
                </Button>
              </DialogActions>
            </Dialog>
          </Stack>
            <Snackbar open={!!successMessage} autoHideDuration={4000} onClose={() => setSuccessMessage('')}>
              <Alert onClose={() => setSuccessMessage('')} severity="success" sx={{ width: '100%' }}>
                {successMessage}
              </Alert>
            </Snackbar>
        </>
      ) : (
        <Typography>Please log in</Typography>
      )}
    </>
  );
}
