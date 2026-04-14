"# software-engineering-project" 
steps to make the project work 

firstly make your own enviorment inside the project call it whatever 
python -m venv "enviornment name"

Activate the environment 
venv( enviromnent name )\Scripts\activate 

Install packages required 
pip install -r requirments.txt 

select correct python environment 
ctrl + shift + p 

select python: select interpreter 
choose ./venv ( your environmnent ) 
if you skip this step : 
 * packages wont work
 * imports will show errors
 * face recognition will fail

go to backend folder 
cd backend 

then run the server 
python -m uvicorn server:app --reload 


summary 

python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd backend
python -m uvicorn server:app --reload
